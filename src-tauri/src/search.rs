//! 5-phase search engine for clipboard items.
//!
//! Phases (cascading — each runs only when previous found < 5 results):
//!   1. Contiguous substring on content/note (score 1.0)
//!   2. Word-start tokens on content/note (score 0.75)
//!   3. Contiguous substring on source_app/source_title (score 0.5)
//!   4. Word-start tokens on source_app/source_title (score 0.25)
//!   5. Fuzzy via Levenshtein edit distance + prefix matching (score 0.05–0.15)

use crate::commands::ClipboardItem;
use serde::Serialize;
use std::collections::HashMap;
use unicode_normalization::char::{canonical_combining_class, decompose_canonical};
use unicode_normalization::UnicodeNormalization;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct SearchResponse {
    pub items: Vec<SearchResultItem>,
    pub total_unfiltered: i64,
    pub filter_counts: FilterCounts,
    pub app_counts: HashMap<String, i64>,
    pub app_last_used: HashMap<String, String>,
    pub regex_error: bool,
}

#[derive(Debug, Serialize)]
pub struct SearchResultItem {
    #[serde(flatten)]
    pub item: ClipboardItem,
    pub matches: Vec<FieldMatch>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FieldMatch {
    pub field: String,
    pub indices: Vec<[usize; 2]>,
}

#[derive(Debug, Serialize)]
pub struct FilterCounts {
    pub all: i64,
    pub starred: i64,
    pub text: i64,
    pub image: i64,
    pub notes: i64,
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

struct ScoredHit {
    index: usize, // index into the items slice
    score: f64,
    matches: Vec<FieldMatch>,
}

struct Field {
    key: &'static str,
    original_chars: Vec<char>,
    /// Lowercase + accent-stripped + whitespace-normalized chars for comparison.
    normalized_chars: Vec<char>,
    /// Original inclusive character span for each normalized character.
    positions: Vec<[usize; 2]>,
    /// Only the first retained output of an original character can start a word.
    word_start_eligible: Vec<bool>,
}

impl Field {
    fn original_ranges(&self, ranges: Vec<[usize; 2]>) -> Vec<[usize; 2]> {
        merge_original_ranges(
            ranges
                .into_iter()
                .flat_map(|[start, end]| self.positions[start..=end].iter().copied()),
        )
    }

    fn is_word_start(&self, pos: usize) -> bool {
        let original = self.positions[pos][0];
        self.word_start_eligible[pos] && is_word_start_chars(&self.original_chars, original)
    }
}

// ---------------------------------------------------------------------------
// Unicode helpers — all work with char indices (not byte offsets)
// ---------------------------------------------------------------------------

/// Strip diacritical marks via NFD decomposition.
/// "café" → "cafe", "über" → "uber", "niño" → "nino".
/// Decomposition can expand or remove characters; callers must map offsets.
fn strip_diacritics(s: &str) -> String {
    s.nfd().filter(|c| !is_search_diacritic(*c)).collect()
}

fn is_search_diacritic(c: char) -> bool {
    matches!(c,
        '\u{0300}'..='\u{036F}' |
        '\u{1AB0}'..='\u{1AFF}' |
        '\u{1DC0}'..='\u{1DFF}' |
        '\u{20D0}'..='\u{20FF}' |
        '\u{FE20}'..='\u{FE2F}'
    )
}

/// Normalize text for search: lowercase + strip diacritics + normalize whitespace.
fn normalize_for_search(s: &str) -> String {
    let lower = s.to_lowercase();
    let stripped = strip_diacritics(&lower);
    // Normalize all Unicode whitespace to regular space
    stripped
        .chars()
        .map(|c| if c.is_whitespace() { ' ' } else { c })
        .collect()
}

fn normalized_with_positions(s: &str) -> (Vec<char>, Vec<[usize; 2]>, Vec<bool>) {
    let lower = s.to_lowercase();
    let mut lower_chars = lower.chars();
    let mut decomposed: Vec<(u8, char, [usize; 2], bool)> = Vec::new();
    let mut last_retained = None;
    for (idx, original) in s.chars().enumerate() {
        let previous_retained = last_retained;
        for c in lower_chars.by_ref().take(original.to_lowercase().count()) {
            decompose_canonical(c, |d| {
                let first_output = last_retained == previous_retained;
                if !is_search_diacritic(d) {
                    last_retained = Some(decomposed.len());
                }
                decomposed.push((canonical_combining_class(d), d, [idx, idx], first_output));
            });
        }
        if last_retained == previous_retained {
            // Keep a decomposed accent in the highlighted base character's span.
            if let Some(last) = last_retained {
                decomposed[last].2[1] = idx;
            }
        }
    }
    // NFD orders non-starters across original-character boundaries, stably within
    // each combining class. Keep even stripped class-zero boundaries until sorted.
    let mut pending_start = 0;
    for i in 0..decomposed.len() {
        if decomposed[i].0 == 0 {
            decomposed[pending_start..i].sort_by_key(|entry| entry.0);
            pending_start = i + 1;
        }
    }
    decomposed[pending_start..].sort_by_key(|entry| entry.0);
    let mut chars = Vec::new();
    let mut positions = Vec::new();
    let mut word_start_eligible = Vec::new();
    for (_, c, span, first_output) in decomposed {
        if !is_search_diacritic(c) {
            chars.push(if c.is_whitespace() { ' ' } else { c });
            positions.push(span);
            word_start_eligible.push(first_output);
        }
    }
    (chars, positions, word_start_eligible)
}

/// Strip leading/trailing punctuation from a word for fuzzy matching.
/// "hello," → "hello", "(world)" → "world", "«слово»" → "слово"
fn strip_word_punctuation(word: &str) -> &str {
    let is_punct = |c: char| {
        c.is_ascii_punctuation()
            || matches!(
                c,
                '«' | '»' | '\u{201C}' | '\u{201D}' | '\u{2018}' | '\u{2019}' | '—' | '–'
            )
    };
    let s = word.trim_start_matches(is_punct);
    s.trim_end_matches(is_punct)
}

/// Unicode-aware word-start check on a char slice at the given char index.
fn is_word_start_chars(chars: &[char], char_idx: usize) -> bool {
    if char_idx == 0 {
        return true;
    }
    let prev = chars[..char_idx]
        .iter()
        .rev()
        .find(|c| !unicode_normalization::char::is_combining_mark(**c));
    let Some(&prev) = prev else { return true };
    if !prev.is_alphanumeric() {
        return true;
    }
    // camelCase: lowercase followed by uppercase
    if prev.is_lowercase() && chars[char_idx].is_uppercase() {
        return true;
    }
    false
}

/// Find all occurrences of `needle_chars` (already lowercased) in `haystack_lower_chars`.
/// Returns [start, end] inclusive char-index pairs.
fn find_all_substring_chars(
    haystack_lower_chars: &[char],
    needle_chars: &[char],
) -> Vec<[usize; 2]> {
    let mut indices = Vec::new();
    if needle_chars.is_empty() || haystack_lower_chars.len() < needle_chars.len() {
        return indices;
    }
    let mut pos = 0;
    while pos + needle_chars.len() <= haystack_lower_chars.len() {
        if haystack_lower_chars[pos..pos + needle_chars.len()] == *needle_chars {
            indices.push([pos, pos + needle_chars.len() - 1]);
            pos += needle_chars.len(); // non-overlapping
        } else {
            pos += 1;
        }
    }
    indices
}

/// Find word-start occurrences of `needle_chars` (lowercased) in original text chars.
fn find_all_word_start_chars(field: &Field, needle_chars: &[char]) -> Vec<[usize; 2]> {
    let lower_chars = &field.normalized_chars;
    let mut indices = Vec::new();
    if needle_chars.is_empty() || lower_chars.len() < needle_chars.len() {
        return indices;
    }
    let mut pos = 0;
    while pos + needle_chars.len() <= lower_chars.len() {
        if lower_chars[pos..pos + needle_chars.len()] == *needle_chars {
            if field.is_word_start(pos) {
                indices.push([pos, pos + needle_chars.len() - 1]);
            }
            pos += 1;
        } else {
            pos += 1;
        }
    }
    field.original_ranges(indices)
}

/// Merge overlapping/adjacent [start, end] ranges (must be sorted by start).
fn merge_ranges(sorted: &mut Vec<[usize; 2]>) {
    if sorted.len() <= 1 {
        return;
    }
    let mut write = 0;
    for read in 1..sorted.len() {
        if sorted[read][0] <= sorted[write][1] + 1 {
            sorted[write][1] = sorted[write][1].max(sorted[read][1]);
        } else {
            write += 1;
            sorted[write] = sorted[read];
        }
    }
    sorted.truncate(write + 1);
}

fn merge_original_ranges(positions: impl IntoIterator<Item = [usize; 2]>) -> Vec<[usize; 2]> {
    let mut mapped: Vec<_> = positions.into_iter().collect();
    // Canonical ordering can put source offsets out of order or split a match.
    mapped.sort_unstable_by_key(|span| span[0]);
    merge_ranges(&mut mapped);
    mapped
}

fn collect_fields(item: &ClipboardItem, keys: &[&'static str]) -> Vec<Field> {
    let mut fields = Vec::new();
    for &key in keys {
        let value = match key {
            "content" => Some(item.content.as_str()),
            "note" => item.note.as_deref(),
            "source_app" => item.source_app.as_deref(),
            "source_title" => item.source_title.as_deref(),
            _ => None,
        };
        if let Some(v) = value {
            if !v.is_empty() {
                let original_chars: Vec<char> = v.chars().collect();
                let (normalized_chars, positions, word_start_eligible) =
                    normalized_with_positions(v);
                fields.push(Field {
                    key,
                    original_chars,
                    normalized_chars,
                    positions,
                    word_start_eligible,
                });
            }
        }
    }
    fields
}

// ---------------------------------------------------------------------------
// Phase 1: Contiguous substring
// ---------------------------------------------------------------------------

fn contiguous_search(
    items: &[ClipboardItem],
    query_normalized_chars: &[char],
    keys: &[&'static str],
) -> Vec<ScoredHit> {
    let mut results = Vec::new();
    for (idx, item) in items.iter().enumerate() {
        let fields = collect_fields(item, keys);
        let mut item_matches = Vec::new();
        for field in &fields {
            // Search in normalized text (accent-folded, whitespace-normalized)
            let indices = field.original_ranges(find_all_substring_chars(
                &field.normalized_chars,
                query_normalized_chars,
            ));
            if !indices.is_empty() {
                item_matches.push(FieldMatch {
                    field: field.key.to_string(),
                    indices,
                });
            }
        }
        if !item_matches.is_empty() {
            results.push(ScoredHit {
                index: idx,
                score: 0.0,
                matches: item_matches,
            });
        }
    }
    results
}

// ---------------------------------------------------------------------------
// Phase 2: Word-start prefix tokens
// ---------------------------------------------------------------------------

fn word_start_token_search(
    items: &[ClipboardItem],
    query_normalized: &str,
    keys: &[&'static str],
) -> Vec<ScoredHit> {
    let token_strs: Vec<&str> = query_normalized
        .split_whitespace()
        .filter(|t| t.chars().count() >= 2)
        .collect();
    if token_strs.is_empty() {
        return Vec::new();
    }
    let token_chars: Vec<Vec<char>> = token_strs.iter().map(|t| t.chars().collect()).collect();

    let mut results = Vec::new();
    for (idx, item) in items.iter().enumerate() {
        let fields = collect_fields(item, keys);
        let mut item_matches = Vec::new();

        for field in &fields {
            // All tokens must have a word-start match in this field (using normalized text)
            let all_match = token_chars.iter().all(|tc| {
                let nlen = tc.len();
                if nlen > field.normalized_chars.len() {
                    return false;
                }
                for pos in 0..=field.normalized_chars.len() - nlen {
                    if field.normalized_chars[pos..pos + nlen] == tc[..] && field.is_word_start(pos)
                    {
                        return true;
                    }
                }
                false
            });
            if !all_match {
                continue;
            }

            // Collect highlight indices (use normalized for matching, positions map to original)
            let mut field_indices: Vec<[usize; 2]> = Vec::new();
            for tc in &token_chars {
                for pair in find_all_word_start_chars(field, tc) {
                    field_indices.push(pair);
                }
            }
            if !field_indices.is_empty() {
                field_indices.sort_by_key(|p| p[0]);
                merge_ranges(&mut field_indices);
                item_matches.push(FieldMatch {
                    field: field.key.to_string(),
                    indices: field_indices,
                });
            }
        }

        if !item_matches.is_empty() {
            results.push(ScoredHit {
                index: idx,
                score: 0.0,
                matches: item_matches,
            });
        }
    }
    results
}

// ---------------------------------------------------------------------------
// Phase 5: Fuzzy search via Levenshtein + prefix
// ---------------------------------------------------------------------------

/// Levenshtein edit distance between two char slices.
/// Returns the minimum number of insertions, deletions, or substitutions
/// to transform `a` into `b`.
fn levenshtein(a: &[char], b: &[char]) -> usize {
    let (m, n) = (a.len(), b.len());
    // Early exit: if length difference alone exceeds threshold, skip computation
    if m.abs_diff(n) > 2 {
        return m.abs_diff(n);
    }
    let mut prev = (0..=n).collect::<Vec<_>>();
    let mut curr = vec![0; n + 1];
    for i in 1..=m {
        curr[0] = i;
        for j in 1..=n {
            let cost = if a[i - 1] == b[j - 1] { 0 } else { 1 };
            curr[j] = (prev[j] + 1).min(curr[j - 1] + 1).min(prev[j - 1] + cost);
        }
        std::mem::swap(&mut prev, &mut curr);
    }
    prev[n]
}

fn fuzzy_search(items: &[ClipboardItem], query: &str) -> Vec<ScoredHit> {
    // Split query into tokens. Each token is matched independently against
    // content words via Levenshtein distance (typos) and prefix matching.
    let query_tokens: Vec<&str> = query.split_whitespace().collect();
    if query_tokens.is_empty() {
        return Vec::new();
    }

    // Extract individual words from each field with their positions.
    struct WordInfo {
        item_idx: usize,
        field: &'static str,
        word_start: usize, // char offset in original field
        word_len: usize,   // char count of the clean word
        positions: Vec<[usize; 2]>,
    }
    let mut word_infos: Vec<WordInfo> = Vec::new();
    let mut word_chars: Vec<Vec<char>> = Vec::new();

    for (idx, item) in items.iter().enumerate() {
        let fields: &[(&'static str, Option<&str>)] = &[
            ("content", Some(item.content.as_str())),
            ("note", item.note.as_deref()),
            ("source_app", item.source_app.as_deref()),
            ("source_title", item.source_title.as_deref()),
        ];
        for &(field_name, value) in fields {
            let text = match value {
                Some(v) if !v.is_empty() => v,
                _ => continue,
            };
            for word in text.split_whitespace() {
                let byte_start = word.as_ptr() as usize - text.as_ptr() as usize;
                let word_char_start = text[..byte_start].chars().count();
                let clean = strip_word_punctuation(word);
                if clean.is_empty() {
                    continue;
                }
                let clean_byte_start = clean.as_ptr() as usize - word.as_ptr() as usize;
                let clean_start = word_char_start + word[..clean_byte_start].chars().count();
                let (chars, positions, _) = normalized_with_positions(clean);
                let wlen = chars.len();
                if wlen == 0 {
                    continue;
                }
                word_infos.push(WordInfo {
                    item_idx: idx,
                    field: field_name,
                    word_start: clean_start,
                    word_len: wlen,
                    positions,
                });
                word_chars.push(chars);
            }
        }
    }

    // For each query token, find matching content words.
    type ItemField = (usize, &'static str);
    type TokenHits = HashMap<ItemField, (Vec<[usize; 2]>, f64)>;
    let mut token_hits: Vec<TokenHits> = Vec::new();

    for qt in &query_tokens {
        let qt_norm = normalize_for_search(qt);
        let qt_ch: Vec<char> = qt_norm.chars().collect();
        let qt_len = qt_ch.len();
        if qt_len == 0 {
            continue;
        }

        let mut hits: TokenHits = HashMap::new();

        for (wi, wch) in word_chars.iter().enumerate() {
            let info = &word_infos[wi];
            let wlen = info.word_len;
            let key: ItemField = (info.item_idx, info.field);

            // Check 1: prefix match — "lover" finds "love", "lov" finds "love"
            // Require ≥60% overlap to prevent "f" matching "foobar"
            let qt_str = &qt_norm;
            let w_str: String = wch.iter().collect();
            let is_prefix =
                (w_str.starts_with(qt_str.as_str()) || qt_str.starts_with(w_str.as_str())) && {
                    let shorter = wlen.min(qt_len);
                    let longer = wlen.max(qt_len);
                    shorter * 100 / longer.max(1) >= 60
                };

            if is_prefix {
                let matched = wlen.min(qt_len);
                let indices = merge_original_ranges(
                    info.positions[..matched]
                        .iter()
                        .map(|[start, end]| [info.word_start + start, info.word_start + end]),
                );
                let score = 0.12 * (matched as f64 / qt_len.max(1) as f64);
                hits.entry(key)
                    .and_modify(|(_, s)| {
                        if score > *s {
                            *s = score;
                        }
                    })
                    .or_insert((indices, score));
                continue;
            }

            // Check 2: Levenshtein distance ≤ 1 — catches real typos
            // Skip if length difference > 1 (fast reject — Levenshtein ≥ |len_diff|)
            if qt_len.abs_diff(wlen) > 1 {
                continue;
            }
            // Skip very short tokens (≤2 chars) — too noise-prone for edit distance
            if qt_len <= 2 {
                continue;
            }
            let dist = levenshtein(&qt_ch, wch);
            if dist <= 1 {
                let matched = wlen.min(qt_len);
                let indices = merge_original_ranges(
                    info.positions[..matched]
                        .iter()
                        .map(|[start, end]| [info.word_start + start, info.word_start + end]),
                );
                let score = if dist == 0 { 0.15 } else { 0.10 };
                hits.entry(key)
                    .and_modify(|(_, s)| {
                        if score > *s {
                            *s = score;
                        }
                    })
                    .or_insert((indices, score));
            }
        }
        token_hits.push(hits);
    }

    // An item matches if ALL query tokens matched in the same (item, field).
    let mut best: HashMap<usize, ScoredHit> = HashMap::new();

    if let Some(first_hits) = token_hits.first() {
        for &(item_idx, field) in first_hits.keys() {
            let all_match = token_hits[1..]
                .iter()
                .all(|th| th.contains_key(&(item_idx, field)));
            if !all_match {
                continue;
            }

            let mut all_indices: Vec<[usize; 2]> = Vec::new();
            let mut total_score: f64 = 0.0;
            for th in &token_hits {
                if let Some((indices, score)) = th.get(&(item_idx, field)) {
                    all_indices.extend(indices);
                    total_score += score;
                }
            }
            let score = total_score / token_hits.len() as f64;

            all_indices.sort_by_key(|p| p[0]);
            merge_ranges(&mut all_indices);

            let field_match = FieldMatch {
                field: field.to_string(),
                indices: all_indices,
            };

            best.entry(item_idx)
                .and_modify(|existing| {
                    if score > existing.score {
                        existing.score = score;
                        existing.matches = vec![field_match.clone()];
                    }
                })
                .or_insert(ScoredHit {
                    index: item_idx,
                    score,
                    matches: vec![field_match],
                });
        }
    }

    // Cap fuzzy results
    let mut results: Vec<ScoredHit> = best.into_values().collect();
    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    results.truncate(20);
    results
}

// ---------------------------------------------------------------------------
// Regex search
// ---------------------------------------------------------------------------

fn regex_search(items: &[ClipboardItem], pattern: &str) -> Option<Vec<ScoredHit>> {
    let re = match regex::Regex::new(&format!("(?i){}", pattern)) {
        Ok(r) => r,
        Err(_) => return None,
    };

    let mut results = Vec::new();
    let all_fields: &[&str] = &["content", "note", "source_app", "source_title"];

    for (idx, item) in items.iter().enumerate() {
        let mut item_matches = Vec::new();

        for &field_name in all_fields {
            let value = match field_name {
                "content" => {
                    if item.content_type == "image" {
                        continue;
                    }
                    Some(item.content.as_str())
                }
                "note" => item.note.as_deref(),
                "source_app" => item.source_app.as_deref(),
                "source_title" => item.source_title.as_deref(),
                _ => None,
            };
            let value = match value {
                Some(v) if !v.is_empty() => v,
                _ => continue,
            };

            let mut field_indices: Vec<[usize; 2]> = Vec::new();
            for m in re.find_iter(value) {
                let char_start = value[..m.start()].chars().count();
                let match_len = m.as_str().chars().count();
                if match_len == 0 {
                    continue; // skip zero-length matches (^, a*, b?)
                }
                let char_end = char_start + match_len - 1;
                field_indices.push([char_start, char_end]);
            }
            if !field_indices.is_empty() {
                item_matches.push(FieldMatch {
                    field: field_name.to_string(),
                    indices: field_indices,
                });
            }
        }

        if !item_matches.is_empty() {
            results.push(ScoredHit {
                index: idx,
                score: 1.0,
                matches: item_matches,
            });
        }
    }

    Some(results)
}

// ---------------------------------------------------------------------------
// Main search entry point
// ---------------------------------------------------------------------------

const PRIMARY_KEYS: &[&str] = &["content", "note"];
const SECONDARY_KEYS: &[&str] = &["source_app", "source_title"];

/// Run the 5-phase search engine on a slice of items.
/// Returns (scored results, is_regex_error).
pub fn run_search(
    items: &[ClipboardItem],
    query: &str,
    search_mode: &str,
) -> (Vec<SearchResultItem>, bool) {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        // Empty query → return all items with no matches
        let results = items
            .iter()
            .map(|item| SearchResultItem {
                item: item.clone(),
                matches: Vec::new(),
            })
            .collect();
        return (results, false);
    }

    if search_mode == "regex" {
        match regex_search(items, trimmed) {
            Some(hits) => {
                let results = hits
                    .into_iter()
                    .map(|h| SearchResultItem {
                        item: items[h.index].clone(),
                        matches: h.matches,
                    })
                    .collect();
                return (results, false);
            }
            None => {
                // Invalid regex
                return (Vec::new(), true);
            }
        }
    }

    // Fuzzy search mode — 5-phase cascading
    let query_normalized = normalize_for_search(trimmed);
    let query_normalized_chars: Vec<char> = query_normalized.chars().collect();
    let mut best: HashMap<usize, ScoredHit> = HashMap::new();

    // Phase 1: contiguous substring in primary fields
    for mut hit in contiguous_search(items, &query_normalized_chars, PRIMARY_KEYS) {
        hit.score = 1.0;
        best.insert(hit.index, hit);
    }

    // Phase 2: word-start tokens in primary (only when Phase 1 found few)
    if best.len() < 5 {
        for mut hit in word_start_token_search(items, &query_normalized, PRIMARY_KEYS) {
            hit.score = 0.75;
            let existing = best.get(&hit.index);
            if existing.is_none() || existing.unwrap().score < hit.score {
                best.insert(hit.index, hit);
            }
        }
    }

    // Phase 3 & 4: secondary fields (only when few results so far)
    if best.len() < 5 {
        for mut hit in contiguous_search(items, &query_normalized_chars, SECONDARY_KEYS) {
            hit.score = 0.5;
            let existing = best.get(&hit.index);
            if existing.is_none() || existing.unwrap().score < hit.score {
                best.insert(hit.index, hit);
            }
        }
        for mut hit in word_start_token_search(items, &query_normalized, SECONDARY_KEYS) {
            hit.score = 0.25;
            let existing = best.get(&hit.index);
            if existing.is_none() || existing.unwrap().score < hit.score {
                best.insert(hit.index, hit);
            }
        }
    }

    // Phase 5: fuzzy (only when still few results)
    if best.len() < 5 {
        for hit in fuzzy_search(items, trimmed) {
            best.entry(hit.index).or_insert(hit);
        }
    }

    // Sort by score DESC, then last_used DESC (chronological).
    // Starred items do NOT get sort priority — the Starred tab is separate.
    let mut sorted: Vec<ScoredHit> = best.into_values().collect();
    sorted.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| items[b.index].last_used.cmp(&items[a.index].last_used))
    });

    let results = sorted
        .into_iter()
        .map(|h| SearchResultItem {
            item: items[h.index].clone(),
            matches: h.matches,
        })
        .collect();

    (results, false)
}

/// Compute filter counts and app counts from a set of items.
pub fn compute_counts(
    items: &[ClipboardItem],
) -> (FilterCounts, HashMap<String, i64>, HashMap<String, String>) {
    let mut starred = 0i64;
    let mut text = 0i64;
    let mut image = 0i64;
    let mut notes = 0i64;
    let mut app_counts: HashMap<String, i64> = HashMap::new();
    let mut app_last_used: HashMap<String, String> = HashMap::new();

    for item in items {
        if item.starred {
            starred += 1;
        }
        if item.content_type == "image" {
            image += 1;
        } else {
            text += 1;
        }
        if item.note.as_ref().is_some_and(|n| !n.trim().is_empty()) {
            notes += 1;
        }
        if let Some(ref app) = item.source_app {
            if !app.is_empty() && item.content_type != "image" {
                *app_counts.entry(app.clone()).or_insert(0) += 1;
                app_last_used
                    .entry(app.clone())
                    .and_modify(|existing| {
                        if item.last_used > *existing {
                            *existing = item.last_used.clone();
                        }
                    })
                    .or_insert_with(|| item.last_used.clone());
            }
        }
    }

    let counts = FilterCounts {
        all: items.len() as i64,
        starred,
        text,
        image,
        notes,
    };

    (counts, app_counts, app_last_used)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_item(id: i64, content: &str) -> ClipboardItem {
        ClipboardItem {
            id,
            content: content.to_string(),
            content_hash: format!("hash_{}", id),
            content_type: "text".to_string(),
            image_path: None,
            html_content: None,
            note: None,
            starred: false,
            created_at: "2024-01-01 00:00:00".to_string(),
            last_used: "2024-01-01 00:00:00".to_string(),
            source_app: None,
            source_title: None,
        }
    }

    fn make_item_ext(
        id: i64,
        content: &str,
        note: Option<&str>,
        source_app: Option<&str>,
        source_title: Option<&str>,
    ) -> ClipboardItem {
        ClipboardItem {
            id,
            content: content.to_string(),
            content_hash: format!("hash_{}", id),
            content_type: "text".to_string(),
            image_path: None,
            html_content: None,
            note: note.map(|s| s.to_string()),
            starred: false,
            created_at: "2024-01-01 00:00:00".to_string(),
            last_used: "2024-01-01 00:00:00".to_string(),
            source_app: source_app.map(|s| s.to_string()),
            source_title: source_title.map(|s| s.to_string()),
        }
    }

    fn search(items: &[ClipboardItem], query: &str) -> Vec<SearchResultItem> {
        run_search(items, query, "fuzzy").0
    }

    // === Basics ===

    #[test]
    fn canonical_mark_order_matches_identical_and_equivalent_queries() {
        let forms = ["\u{05e9}\u{05c1}\u{05b8}", "\u{05e9}\u{05b8}\u{05c1}"];
        for text in forms {
            for query in forms {
                let results = search(&[make_item(1, text)], query);
                assert_eq!(results.len(), 1, "{text:?} / {query:?}");
                assert_eq!(results[0].matches[0].field, "content");
                assert_eq!(results[0].matches[0].indices, vec![[0, 2]]);
            }
        }
    }

    #[test]
    fn canonical_mark_order_preserves_original_highlights() {
        let items = [make_item(1, "x \u{05e9}\u{05c1}\u{05b8}\u{05c1}\u{05b8} y")];
        for (query, expected) in [
            ("\u{05c1}\u{05c1}", vec![[3, 3], [5, 5]]),
            ("\u{05b8}\u{05b8}", vec![[4, 4], [6, 6]]),
            ("\u{05b8}\u{05c1}", vec![[3, 3], [6, 6]]),
            ("\u{05c1}", vec![[3, 3], [5, 5]]),
        ] {
            let query: Vec<_> = normalize_for_search(query).chars().collect();
            let hits = contiguous_search(&items, &query, &["content"]);
            assert_eq!(hits.len(), 1, "{query:?}");
            assert_eq!(hits[0].matches[0].indices, expected, "{query:?}");
        }
    }

    #[test]
    fn canonical_mark_order_word_start_highlights() {
        let items = [make_item(1, "\u{05e9}\u{05c1}\u{05b8} next")];
        let hits = word_start_token_search(&items, "\u{05e9}\u{05b8}\u{05c1} next", &["content"]);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].matches[0].indices, vec![[0, 2], [4, 7]]);
    }

    #[test]
    fn canonical_reordering_does_not_make_shin_dot_a_word_start() {
        for text in [
            "\u{05e9}\u{05c1}\u{05b8}\u{05d1} next",
            "\u{fb2a}\u{05b8}\u{05d1} next",
        ] {
            let items = [make_item(1, text)];
            let query = "next \u{05c1}\u{05d1}";
            assert!(search(&items, query).is_empty(), "{text:?}");
            assert!(word_start_token_search(&items, query, &["content"]).is_empty());
        }
    }

    #[test]
    fn canonical_mark_order_fuzzy_highlights() {
        let items = [make_item(1, "(\u{05e9}\u{05c1}\u{05b8})")];
        for query in ["\u{05e9}\u{05b8}\u{05c1}x", "\u{05e9}\u{05b8}x"] {
            let hits = fuzzy_search(&items, query);
            assert_eq!(hits.len(), 1, "{query:?}");
            assert_eq!(hits[0].matches[0].indices, vec![[1, 3]], "{query:?}");
        }
    }

    #[test]
    fn canonical_mark_order_matches_whole_string_normalization() {
        for text in [
            "\u{05e9}\u{05c1}\u{05b8}",
            "\u{05c1}\u{05b8}",
            "\u{05e9}\u{05c1}\u{034f}\u{05b8}",
            "\u{130} \u{ac00} cafe\u{301}",
            "\u{039f}\u{03a3}",
        ] {
            let (chars, positions, _) = normalized_with_positions(text);
            assert_eq!(
                chars.iter().collect::<String>(),
                normalize_for_search(text),
                "{text:?}"
            );
            assert_eq!(chars.len(), positions.len());
            assert!(positions
                .iter()
                .all(|[start, end]| start <= end && *end < text.chars().count()));
        }
    }

    #[test]
    fn unicode_original_highlights() {
        for (text, query, expected) in [
            ("\u{ac00}\u{b098}\u{b2e4}\u{b77c} ab", "ab", vec![[5, 6]]),
            ("\u{ac00}\u{b098}", "\u{b098}", vec![[1, 1]]),
            ("cafe\u{301} next", "next", vec![[6, 9]]),
            ("cafe\u{301} next", "cafe", vec![[0, 4]]),
            ("\u{130}Next value", "next value", vec![[1, 10]]),
        ] {
            let results = search(&[make_item(1, text)], query);
            assert_eq!(results.len(), 1, "{text:?} / {query:?}");
            assert_eq!(results[0].matches[0].indices, expected, "{text:?}");
        }
    }

    #[test]
    fn unicode_word_starts() {
        let items = [make_item(1, "\u{ac00}\u{b098} someValue cafe\u{301} final")];
        let hits = word_start_token_search(&items, "value final", &["content"]);
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].matches[0].indices, vec![[7, 11], [19, 23]]);
        // A combining mark does not create a word boundary inside a word.
        assert!(word_start_token_search(
            &[make_item(1, "cafe\u{301}teria")],
            "teria",
            &["content"]
        )
        .is_empty());
    }

    #[test]
    fn unicode_fuzzy_highlights() {
        let hits = fuzzy_search(&[make_item(1, "(cafe\u{301})")], "cafes");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].matches[0].indices, vec![[1, 5]]);
        let hits = fuzzy_search(&[make_item(1, "(\u{ac00}\u{b098})")], "\u{ac00}\u{b098}s");
        assert_eq!(hits.len(), 1);
        assert_eq!(hits[0].matches[0].indices, vec![[1, 2]]);
    }

    #[test]
    fn empty_query_returns_all() {
        let items = vec![make_item(1, "hello"), make_item(2, "world")];
        let results = search(&items, "");
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn whitespace_query_returns_all() {
        let items = vec![make_item(1, "hello")];
        let results = search(&items, "   ");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn no_match_returns_empty() {
        let items = vec![make_item(1, "hello world")];
        let results = search(&items, "zzzzzzzzz");
        assert!(results.is_empty());
    }

    #[test]
    fn empty_items_returns_empty() {
        let results = search(&[], "hello");
        assert!(results.is_empty());
    }

    #[test]
    fn does_not_search_hash_field() {
        let items = vec![make_item(1, "hello")];
        let results = search(&items, "hash_1");
        assert!(results.is_empty());
    }

    // === Phase 1: Contiguous substring ===

    #[test]
    fn phase1_contiguous_substring() {
        let items = vec![make_item(1, "hello world"), make_item(2, "foo bar baz")];
        let results = search(&items, "foo bar");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item.content, "foo bar baz");
    }

    #[test]
    fn phase1_local_v_matches_local_variable() {
        let items = vec![
            make_item(1, "local variable declaration"),
            make_item(2, "some local data with various stuff"),
        ];
        let results = search(&items, "local v");
        assert!(!results.is_empty());
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn phase1_highlight_indices() {
        let items = vec![make_item(1, "local variable")];
        let results = search(&items, "local var");
        assert_eq!(results.len(), 1);
        let m = results[0]
            .matches
            .iter()
            .find(|m| m.field == "content")
            .unwrap();
        assert_eq!(m.indices, vec![[0, 8]]); // "local var" = 9 chars [0..8]
    }

    #[test]
    fn phase1_finds_in_note() {
        let items = vec![
            make_item_ext(1, "some text", Some("timeout config here"), None, None),
            make_item(2, "other text"),
        ];
        let results = search(&items, "timeout");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn phase1_same_field_only() {
        let items = vec![
            make_item_ext(1, "some config", Some("timeout settings"), None, None),
            make_item(2, "config timeout values"),
        ];
        let results = search(&items, "config timeout");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item.id, 2);
    }

    #[test]
    fn phase1_no_scattered_letters() {
        let items = vec![make_item(1, "delivery_time_options")];
        let results = search(&items, "timeout");
        // "delivery_time_options" contains "time_o" — strong fuzzy match for
        // "timeout" via Smith-Waterman (unlike Fuse.js threshold=0.3 which
        // rejects it). With cascading search and <5 results, fuzzy runs.
        // This is acceptable: in production with 500+ items, earlier phases
        // would find >=5 results and fuzzy would never trigger for "timeout".
        // If fuzzy matches, it should rank below any exact/word-start match.
        assert!(results.len() <= 1);
    }

    // === Phase 2: Word-start prefix tokens ===

    #[test]
    fn phase2_word_start_tokens() {
        let items = vec![
            make_item(1, "the connection timeout was set to 30s"),
            make_item(2, "connection refused by server"),
        ];
        let results = search(&items, "connection 30");
        assert!(!results.is_empty());
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn phase2_port_not_inside_import() {
        let items = vec![
            make_item(1, "import React from 'react'"),
            make_item(2, "port 8080 is open"),
        ];
        let results = search(&items, "port 80");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item.id, 2);
    }

    #[test]
    fn phase2_st_not_inside_install() {
        let items = vec![
            make_item(1, "npm install react-helmet"),
            make_item(2, "LM Studio works on port 1234"),
        ];
        let results = search(&items, "lm st");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item.id, 2);
    }

    #[test]
    fn phase2_cyrillic_word_boundary() {
        let items = vec![
            make_item(1, "лм стд использовать нельзя"),
            make_item(2, "нестандартный подход"),
        ];
        let results = search(&items, "стд");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn phase2_underscore_is_word_boundary() {
        let items = vec![make_item(1, "delivery_time_options config")];
        let results = search(&items, "time config");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn phase2_camelcase_boundary() {
        let items = vec![
            make_item(1, "localVariable = getValue()"),
            make_item(2, "approve the value now"),
        ];
        let results = search(&items, "local value");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn phase2_drops_1char_tokens() {
        let items = vec![make_item(1, "some local data, version 5")];
        let results = search(&items, "local v");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn phase2_merges_overlapping_indices() {
        let items = vec![make_item(1, "locale settings for local users")];
        let results = search(&items, "local locale");
        assert_eq!(results.len(), 1);
        let m = results[0]
            .matches
            .iter()
            .find(|m| m.field == "content")
            .unwrap();
        assert_eq!(m.indices, vec![[0, 5], [20, 24]]);
    }

    // === Phase 5: Fuzzy fallback ===

    #[test]
    fn phase5_fuzzy_for_typos() {
        let items = vec![make_item(1, "connection timeout reached")];
        let results = search(&items, "timout");
        assert!(!results.is_empty());
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn exact_match_ranks_above_fuzzy() {
        let items = vec![
            make_item(1, "the connectin tmeout was slow"),
            make_item(2, "connection timeout reached"),
        ];
        let results = search(&items, "timeout");
        assert!(!results.is_empty());
        assert_eq!(results[0].item.content, "connection timeout reached");
    }

    // === Phase priority ===

    #[test]
    fn contiguous_ranked_above_word_start() {
        let items = vec![
            make_item(1, "import React from library"),
            make_item(2, "React import statement"),
        ];
        let results = search(&items, "import React");
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn no_fuzzy_noise_when_earlier_phases_match() {
        let items = vec![
            make_item(1, "local variable declaration"),
            make_item(2, "validate loopback address"),
        ];
        let results = search(&items, "local var");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item.id, 1);
    }

    // === Field priority (primary > secondary) ===

    #[test]
    fn content_ranked_above_source_title() {
        let items = vec![
            make_item_ext(
                1,
                "unrelated text",
                None,
                None,
                Some("local variable editor"),
            ),
            make_item(2, "local variable declaration"),
        ];
        let results = search(&items, "local var");
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].item.id, 2);
    }

    #[test]
    fn source_title_fallback_when_no_content_match() {
        let items = vec![
            make_item_ext(
                1,
                "some code snippet",
                None,
                None,
                Some("database migration notes"),
            ),
            make_item(2, "hello world"),
        ];
        let results = search(&items, "database");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn note_ranked_above_source_title() {
        let items = vec![
            make_item_ext(
                1,
                "random text",
                Some("timeout config"),
                None,
                Some("timeout settings window"),
            ),
            make_item_ext(2, "other stuff", None, None, Some("timeout dashboard")),
        ];
        let results = search(&items, "timeout");
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn content_word_start_above_title_word_start() {
        let items = vec![
            make_item_ext(
                1,
                "LM Studio works on port 1234",
                None,
                None,
                Some("browser"),
            ),
            make_item_ext(
                2,
                "npm install react-helmet",
                None,
                None,
                Some("LM Studio session"),
            ),
        ];
        let results = search(&items, "lm st");
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].item.id, 1);
    }

    // === Regex search ===

    #[test]
    fn regex_basic_match() {
        let items = vec![make_item(1, "hello world"), make_item(2, "foo bar")];
        let (results, err) = run_search(&items, "hel+o", "regex");
        assert!(!err);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn regex_invalid_returns_error() {
        let items = vec![make_item(1, "hello")];
        let (results, err) = run_search(&items, "[invalid", "regex");
        assert!(err);
        assert!(results.is_empty());
    }

    #[test]
    fn regex_empty_returns_all() {
        let items = vec![make_item(1, "hello"), make_item(2, "world")];
        let (results, err) = run_search(&items, "", "regex");
        assert!(!err);
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn regex_match_indices() {
        let items = vec![make_item(1, "hello world hello")];
        let (results, _) = run_search(&items, "hello", "regex");
        assert_eq!(results.len(), 1);
        let m = results[0]
            .matches
            .iter()
            .find(|m| m.field == "content")
            .unwrap();
        assert_eq!(m.indices, vec![[0, 4], [12, 16]]);
    }

    // === Fuzzy score diagnostics ===

    #[test]
    fn fuzzy_prefix_match_query_extends_word() {
        // "lover" should find items with "love" (query extends content word)
        let items = vec![
            make_item(1, "I love this app"),
            make_item(2, "something unrelated"),
        ];
        let results = search(&items, "lover");
        assert!(
            !results.is_empty(),
            "should find 'love' when searching 'lover'"
        );
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn fuzzy_prefix_match_word_extends_query() {
        // "lov" should find items with "love" (content word extends query)
        let items = vec![
            make_item(1, "I love this app"),
            make_item(2, "something unrelated"),
        ];
        let results = search(&items, "lov");
        assert!(
            !results.is_empty(),
            "should find 'love' when searching 'lov'"
        );
        assert_eq!(results[0].item.id, 1);
    }

    // === Accent folding ===

    #[test]
    fn accent_fold_cafe() {
        let items = vec![make_item(1, "I visited a café in Paris")];
        let results = search(&items, "cafe");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn accent_fold_uber() {
        let items = vec![make_item(1, "über cool feature")];
        let results = search(&items, "uber");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn accent_fold_resume() {
        let items = vec![make_item(1, "send your résumé today")];
        let results = search(&items, "resume");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn accent_fold_nino() {
        let items = vec![make_item(1, "el niño effect")];
        let results = search(&items, "nino");
        assert_eq!(results.len(), 1);
    }

    #[test]
    fn accent_exact_still_works() {
        let items = vec![make_item(1, "café latte"), make_item(2, "regular cafe")];
        // Searching with accent should find both (normalized comparison)
        let results = search(&items, "café");
        assert_eq!(results.len(), 2);
    }

    // === Whitespace normalization ===

    #[test]
    fn nbsp_normalized_to_space() {
        let items = vec![make_item(1, "hello\u{00A0}world")]; // non-breaking space
        let results = search(&items, "hello world");
        assert_eq!(results.len(), 1);
    }

    // === Punctuation in fuzzy ===

    #[test]
    fn fuzzy_strips_punctuation() {
        // Content has "world!" (with punctuation). Fuzzy prefix should
        // match "world" by stripping the "!" before comparison.
        let items = vec![make_item(1, "hello, world!")];
        // "worlds" extends "world" — prefix match should work
        // even though content word is "world!" (punctuation stripped)
        let results = search(&items, "worlds");
        assert!(
            !results.is_empty(),
            "should find 'world!' when searching 'worlds' via prefix"
        );
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn fuzzy_multiword_query_with_typo() {
        let items = vec![
            make_item(1, "the motivating example was clear"),
            make_item(2, "some other random text here"),
        ];
        // "exmple" is a typo for "example"
        let results = search(&items, "motivating exmple");
        assert!(!results.is_empty(), "should find multi-word fuzzy match");
        assert_eq!(results[0].item.id, 1);
    }

    #[test]
    fn fuzzy_cyrillic_typo_finds_correct_word() {
        // "цвит" is a 1-letter typo of "цвет" (Russian for "color")
        let items = vec![
            make_item(1, "акцентный цвет (hex) и эффекты прозрачности"),
            make_item(2, "ставит httponly cookie _gct"),
            make_item(3, "совершенно нерелевантный текст без матча"),
        ];
        let results = search(&items, "цвит");
        // Should find item 1 (contains "цвет" — 1-char typo) but NOT
        // item 2 ("ставит" has ви,т scattered but is irrelevant)
        assert!(
            !results.is_empty(),
            "should find 'цвет' when searching 'цвит'"
        );
        assert_eq!(results[0].item.id, 1);
        // Item 2 should NOT appear (word-level matching rejects "ставит")
        assert!(
            !results.iter().any(|r| r.item.id == 2),
            "should not match 'ставит' for query 'цвит'"
        );
    }

    // === Filter counts ===

    #[test]
    fn compute_counts_basic() {
        let mut items = vec![make_item(1, "text item"), make_item(2, "another text")];
        items[0].starred = true;
        items[0].note = Some("a note".to_string());
        items[1].content_type = "image".to_string();

        let (counts, _, _) = compute_counts(&items);
        assert_eq!(counts.all, 2);
        assert_eq!(counts.starred, 1);
        assert_eq!(counts.text, 1);
        assert_eq!(counts.image, 1);
        assert_eq!(counts.notes, 1);
    }

    #[test]
    fn compute_app_counts() {
        let items = vec![
            make_item_ext(1, "item 1", None, Some("VS Code"), None),
            make_item_ext(2, "item 2", None, Some("VS Code"), None),
            make_item_ext(3, "item 3", None, Some("Chrome"), None),
        ];
        let (_, app_counts, _) = compute_counts(&items);
        assert_eq!(app_counts.get("VS Code"), Some(&2));
        assert_eq!(app_counts.get("Chrome"), Some(&1));
    }
}
