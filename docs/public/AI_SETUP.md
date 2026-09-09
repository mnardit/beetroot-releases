# AI Setup Guide

Beetroot can transform your clipboard text using AI -- translate, summarize, fix grammar, rewrite, and more. You bring your own API key (BYOK). Beetroot stores clipboard history locally. For AI transforms, it sends the selected clipboard content and prompt to the AI provider you choose only when you explicitly ask for a transform.

**Documentation scope:** Current source, including changes planned for 1.6.7. See the [release status](index.md); this is not the documentation bundled with the current 1.6.6 installer.
**Last updated:** 2026-09-08

---

## Supported Providers

| Provider          | Speed    | Cost                  | Best for                             |
| ----------------- | -------- | --------------------- | ------------------------------------ |
| **OpenAI**        | Fast     | Paid                  | General transforms, widely used      |
| **Google Gemini** | Fast     | Free tier available   | Budget-friendly option               |
| **Anthropic**     | Fast     | Paid                  | High-quality rewrites                |
| **DeepSeek**      | Moderate | Very cheap            | Deep reasoning tasks                 |
| **Local LLM**     | Varies   | Depends on your setup | Downloaded models on your own server |

---

## Cloud Provider Setup

Saving a key is separate from saving provider and model settings. The disk icon beside the API key input has the tooltip **Save key now**; wait for **Key saved in Windows Credential Manager** before using **Test**. Test is disabled while an unsaved key remains in the input. The bottom **Save** button saves provider/model settings, not the key. **Test** sends the saved key to the selected provider to validate it, without sending clipboard content.

### OpenAI

**Models:** gpt-5.4-nano (fast, cheapest) or gpt-5.4-mini (smarter, for complex tasks)

1. Go to [platform.openai.com](https://platform.openai.com) and sign in or create an account.
2. Navigate to API keys and create a new key. It starts with `sk-`.
3. In Beetroot, open Settings > AI.
4. Select **OpenAI** as your provider.
5. Paste your API key.
6. Click the disk icon (**Save key now**) and wait for **Key saved in Windows Credential Manager**.
7. Click **Test** and wait for **API key is valid**.
8. Choose a model -- gpt-5.4-nano is recommended to start (fast and cheap).
9. Click the bottom **Save** button to save your provider and model settings.

> If you previously used gpt-5-nano or gpt-5-mini, Beetroot automatically migrates your setting to the updated model names (gpt-5.4-nano / gpt-5.4-mini). No action is needed.

### Google Gemini

**Models:** gemini-2.5-flash-lite (fastest) or gemini-2.5-flash (better reasoning)

1. Go to [aistudio.google.com](https://aistudio.google.com) and sign in with your Google account.
2. Click "Get API key" and create a key. It starts with `AIza`.
3. In Beetroot, open Settings > AI.
4. Select **Google Gemini** as your provider.
5. Paste your API key.
6. Click the disk icon (**Save key now**) and wait for **Key saved in Windows Credential Manager**.
7. Click **Test** and wait for **API key is valid**.
8. Choose a model -- gemini-2.5-flash-lite is the fastest option.
9. Click the bottom **Save** button to save your provider and model settings.

> Gemini offers a generous free tier, making it a great starting point if you want to try AI transforms without spending anything.

### Anthropic

**Models:** claude-haiku-4-5 (fastest) or claude-sonnet-4-6 (best balance of speed and quality)

1. Go to [console.anthropic.com](https://console.anthropic.com) and sign in or create an account.
2. Navigate to API keys and create one. It starts with `sk-ant-`.
3. In Beetroot, open Settings > AI.
4. Select **Anthropic** as your provider.
5. Paste your API key.
6. Click the disk icon (**Save key now**) and wait for **Key saved in Windows Credential Manager**.
7. Click **Test** and wait for **API key is valid**.
8. Choose a model -- claude-haiku-4-5 is recommended for quick transforms.
9. Click the bottom **Save** button to save your provider and model settings.

### DeepSeek

**Models:** deepseek-chat (everyday tasks) or deepseek-reasoner (deep reasoning, chain-of-thought)

1. Go to [platform.deepseek.com](https://platform.deepseek.com) and sign in or create an account.
2. Create an API key in your dashboard.
3. In Beetroot, open Settings > AI.
4. Select **DeepSeek** as your provider.
5. Paste your API key.
6. Click the disk icon (**Save key now**) and wait for **Key saved in Windows Credential Manager**.
7. Click **Test** and wait for **API key is valid**.
8. Choose a model -- deepseek-chat is good for most tasks; deepseek-reasoner is for complex analysis.
9. Click the bottom **Save** button to save your provider and model settings.

> DeepSeek offers very competitive pricing. The deepseek-reasoner model shows its thinking process, which is automatically cleaned from the output.

---

## Local LLM Setup (No Internet Required)

Run a downloaded model on your computer without a cloud API key. Beetroot connects over loopback; check your server's logging, forwarding and network settings to keep processing local.

### Option 1: Ollama

[Ollama](https://ollama.com) is the easiest way to run local models.

1. Download and install Ollama from [ollama.com](https://ollama.com).
2. Open a terminal and pull a model:
   ```
   ollama pull llama3.2
   ```
3. Ollama runs automatically in the background on port 11434.
4. In Beetroot, open Settings > AI.
5. Select **Local LLM** as your provider.
6. Choose the **Ollama** preset -- the endpoint fills in automatically.
7. Click **Test** -- Beetroot will connect and show a dropdown of your installed models.
8. Select your model from the dropdown.
9. Click **Save**.

**Recommended Ollama models:**

- `llama3.2` -- Good general-purpose model, runs on most hardware
- `mistral` -- Fast and capable
- `gemma2` -- Google's open model, good for text tasks

### Option 2: LM Studio

[LM Studio](https://lmstudio.ai) provides a graphical interface for managing and running local models.

1. Download and install LM Studio from [lmstudio.ai](https://lmstudio.ai).
2. Download a model through the LM Studio interface.
3. Start the local server (LM Studio runs on port 1234 by default).
4. In Beetroot, open Settings > AI.
5. Select **Local LLM** as your provider.
6. Choose the **LM Studio** preset.
7. Click **Test** to verify the connection. The loaded model is detected automatically.
8. Click **Save**.

### Option 3: Custom Endpoint

Any server that speaks the OpenAI-compatible API format works with Beetroot.

1. Start your model server.
2. In Beetroot Settings > AI, select **Local LLM**.
3. Choose **Custom** and enter your endpoint URL (e.g., `http://127.0.0.1:8080/v1/chat/completions`).
4. Enter the model name.
5. Click **Test** and **Save**.

---

## Model Recommendations

| Goal                  | Provider      | Model                 | Why                                 |
| --------------------- | ------------- | --------------------- | ----------------------------------- |
| Cheapest cloud option | Google Gemini | gemini-2.5-flash-lite | Generous free tier                  |
| Best quality          | Anthropic     | claude-sonnet-4-6     | Excellent rewrites and translations |
| Fastest               | OpenAI        | gpt-5.4-nano          | Lowest latency                      |
| Deep analysis         | DeepSeek      | deepseek-reasoner     | Chain-of-thought reasoning          |
| Full privacy          | Local LLM     | llama3.2 (Ollama)     | Nothing leaves your machine         |
| Offline use           | Local LLM     | Any Ollama model      | Works without internet              |

---

## Using AI Transforms

Once a provider is set up, there are two ways to transform text:

### Method 1: Transform Panel

1. Select a text clip in the list.
2. Press **Alt+T** (or right-click > Transform).
3. The Transform panel shows 8 built-in text transforms (UPPERCASE, lowercase, Title Case, Trim whitespace, Remove Spaces, Single Line, Sort Lines, Remove Duplicates) and your AI prompts below. A search field appears when there are 6 or more items.
4. Click an AI prompt. The text is sent to your provider.
5. The transformed result is saved as a new clip in your history.

### Method 2: Quick Access from Context Menu

1. Right-click a text clip.
2. At the bottom of the context menu, you'll see your Quick Access prompts (up to 5).
3. Click one to transform the text immediately.

> To enable Quick Access on a prompt, go to Settings > AI and check the "Quick Access" box next to the prompts you use most often. Up to 5 prompts can be Quick Access at once.

---

## Built-in Prompts

Beetroot comes with 10 ready-to-use AI prompts:

| Prompt            | What it does                                         |
| ----------------- | ---------------------------------------------------- |
| Fix Grammar       | Corrects grammatical errors without changing meaning |
| Any to English    | Detects the language and translates to English       |
| Summarize         | Condenses text into 2-3 key sentences                |
| Make Professional | Rewrites in a clear, business-appropriate tone       |
| Format as Code    | Applies proper code indentation and formatting       |
| Bullet Points     | Converts text into a bulleted list                   |
| Simplify          | Rewrites in plain, simple language                   |
| Make Shorter      | Condenses to roughly half the length                 |
| Explain This      | Explains in simple terms for anyone                  |
| Extract Key Data  | Extracts names, dates, numbers, and URLs             |

You can also create your own custom prompts (up to 20 total, including built-ins) in Settings > AI.

---

## Troubleshooting

| Problem                          | Solution                                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| "Set API key in Settings"        | In Settings > AI, paste the selected provider's key, click **Save key now**, then **Test**, then **Save** for provider/model settings. |
| "API key is invalid"             | Double-check your key. Make sure it matches the selected provider.                                                                     |
| "Request timed out (30s)"        | The provider took too long. Try again or switch to a faster model.                                                                     |
| "Empty response"                 | The AI returned nothing. Try a different prompt or model.                                                                              |
| "Text too long for AI transform" | The request exceeds the AI input limit. Select a shorter section; encoded size matters as well as character count.                     |
| Local LLM "Failed"               | Make sure your model server (Ollama or LM Studio) is running and the endpoint is correct.                                              |

---

## Privacy

- Beetroot sends selected text or an image and a prompt to an AI provider when you request a transform.
- Only the specific clip you are transforming is sent -- never your full clipboard history.
- Local LLM requests go to a loopback server. That server's own network activity and retention are outside Beetroot's control.
- Cloud API keys are saved in Windows Credential Manager and are transmitted only to their respective provider for key tests and transforms. Non-secret settings are stored separately in the WebView's `localStorage`.

---

_Last updated: 2026-09-08_
