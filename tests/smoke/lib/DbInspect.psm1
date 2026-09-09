# tests/smoke/lib/DbInspect.psm1
# Read-only SQLite inspection helpers for the Beetroot database.
#
# Schema (from src-tauri/src/commands/db.rs ITEM_COLUMNS):
#   clipboard_items(id, content, content_hash, content_type, image_path,
#                   html_content, note, pinned, created_at, last_used,
#                   source_app, source_title)
#
# Older databases (created before migrations v8/v9) may lack source_app /
# source_title — selecting only the always-present columns keeps the query
# portable across versions.

Import-Module "$PSScriptRoot/AppLifecycle.psm1"

function Get-BeetrootHistoryItems {
    <#
    .SYNOPSIS
    Returns the most-recent N rows from clipboard_items as PSCustomObject[].

    .PARAMETER Limit
    Maximum number of rows to return. Defaults to 100.

    .NOTES
    Uses sqlite3.exe in read-only JSON mode. Requires sqlite3 on PATH.
    #>
    [CmdletBinding()]
    param(
        [ValidateRange(1, 10000)][int]$Limit = 100
    )

    $dbPath = Get-BeetrootDbPath
    if (-not (Test-Path $dbPath)) { throw "DB not found: $dbPath" }

    $sql = "SELECT id, content, content_type, pinned, created_at, last_used FROM clipboard_items ORDER BY id DESC LIMIT $Limit;"
    $output = & sqlite3.exe -readonly -json $dbPath $sql 2>&1

    if ($LASTEXITCODE -ne 0) {
        throw "sqlite3 query failed (exit $LASTEXITCODE): $output"
    }

    if (-not $output) { return @() }
    return ($output | Out-String | ConvertFrom-Json)
}

Export-ModuleMember -Function Get-BeetrootHistoryItems
