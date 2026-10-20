<!-- awesome-copilot skills/azure-architecture-autopilot/references/phase1-advisor.md 150-230行 と SKILL.md 抜粋 (@613efc8c) -->
            → v1 scope check: Fabric is v1 scope and provides Spark → MUST include
            → Targeted fetch of each service's MS Docs → Present full comparison table
```

This principle applies not only to service category exploration, but to all situations where the user requests "alternatives", "other options", "comparison", etc.

**🔹 ask_user Tool — Mandatory Usage:**

For questions with choices, you MUST use the `ask_user` tool. It allows users to select with arrow keys for convenience, and they can also type a custom input.

**ask_user usage rules:**
- Questions with 2 or more choices **MUST** use ask_user (do not list them as text)
- **`choices` MUST be passed as a string array (`["A", "B"]`)** — passing as a string (`"A, B"`) will cause an error
- If there is a recommended option, place it first and append `(Recommended)` at the end
- Include reference information in choices — e.g., `"Standard S1 - Recommended for production. Ref: https://..."`
- **Only 1 question per call** — if multiple items need to be asked, call ask_user sequentially for each
- Choices are limited to a maximum of 4. If there are 5 or more, include only the 3-4 most common ones (users can also type a custom input)
- If multiple selections are needed, split them into separate questions

**Items requiring ask_user:**
- Deployment location (region) selection
- SKU/tier selection
- Model selection (chat model, embedding model, etc.)
- Networking method selection
- Subscription selection (Phase 1 Step 2)
- Resource group selection (Phase 1 Step 3)
- Any other question requiring a user choice

**Usage examples:**
```
// Project name is free-form input so ask_user is not used (ask as text)
// SKU, region, etc. with defined choices use ask_user:

// 1. SKU question
ask_user({
  question: "Please select the SKU for AI Search. Ref: https://learn.microsoft.com/en-us/azure/search/search-sku-tier",
  choices: [
    "Standard S1 - Recommended for production (Recommended)",
    "Basic - For dev/test, up to 15 indexes",
    "Standard S2 - High-traffic production",
    "Free - Free trial, 50MB storage"
  ]
})

// 2. Region question (separate call — only 1 question per call)
ask_user({
  question: "Please select the Azure region for deployment. Ref: https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models",
  choices: [
    "Korea Central - Korea region, supports most services (Recommended)",
    "East US - US East, supports all AI models",
    "Japan East - Japan East, close to Korea"
  ]
})
```

> **Note**: The SKU and region values in the examples above are for illustration only. When actually asking, dynamically compose choices based on the latest information by querying MS Docs via web_fetch. Do not hardcode.

**Example — When user input is insufficient:**
```
User: "I want to build a RAG chatbot. Using a GPT model in Foundry and AI Search."

→ Confirmed: Microsoft Foundry, Azure AI Search
→ Still undecided: Project name, specific model name, embedding model, networking (PE?), SKU, deployment location

The agent first confirms the project name via ask_user (default: rag-chatbot).
Then provides choices for each undecided item via the ask_user tool.
Include MS Docs URLs in the choices so the user can reference them directly.
```

**🚨🚨🚨 [HARD GATE] Spec Collection Complete → Diagram Generation Required 🚨🚨🚨**

**Immediately after all confirmed items are filled in, you MUST perform the following steps IN ORDER. Skipping any step means Phase 1 is incomplete.**

1. Compose **services JSON + connections JSON** based on the confirmed service list
2. Use the built-in diagram engine to generate **`<project-name>/01_arch_diagram_draft.html`**
3. Automatically open it in the browser via `Start-Process`
4. Show the diagram to the user in the **report format** below — this MUST include a **detailed configuration table**
5. Ask the user: **"Would you like to change or add anything?"**
6. If the user has no changes → proceed to Phase 2 transition (ask_user with next step guidance)

**NEVER do this:**
