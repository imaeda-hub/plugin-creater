# 付録A-1 ask_user の原文（Copilot CLI 1.0.98、偽物のモデルへのリクエストから取得）

取得元：`research/cli/captures/` の各ファイル（モデルに渡ったリクエスト本文をそのまま保存したもの）。2026-10-20 取得。

## 1. 対話モード（TUI）で使われる形：elicitation（フォーム）版

取得元：`captures/i1-gpt41-tui.tools.json`（`copilot -i "hi"`、gpt-4.1）。全13モデルで同一（md5 一致）。

### 1-1. ツール定義（tools 配列の要素、そのまま）

```json
{
  "type": "function",
  "function": {
    "name": "ask_user",
    "description": "Ask the user a question and wait for their response.\nUse this tool when you need to ask the user questions during execution. This allows you to:\n1. Gather user preferences or requirements\n2. Clarify ambiguous instructions\n3. Get decisions on implementation choices as you work\n4. Collect multiple related pieces of information in a single interaction",
    "parameters": {
      "type": "object",
      "properties": {
        "message": {
          "type": "string",
          "description": "A message describing what information you need from the user. Be clear and specific."
        },
        "requestedSchema": {
          "type": "object",
          "properties": {
            "properties": {
              "type": "object",
              "additionalProperties": {
                "anyOf": [
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "string"
                      },
                      "title": {
                        "type": "string",
                        "description": "Human-readable label for the field."
                      },
                      "description": {
                        "type": "string",
                        "description": "Help text describing the field."
                      },
                      "enum": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        },
                        "description": "Suggested string values. The user can also provide a freeform answer."
                      },
                      "enumNames": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        },
                        "description": "Optional display labels for each suggested value, in the same order as `enum`."
                      },
                      "default": {
                        "type": "string",
                        "description": "Default value selected when the form is first shown."
                      }
                    },
                    "required": [
                      "type",
                      "enum"
                    ],
                    "additionalProperties": false,
                    "description": "Single-select string field with suggested values and a freeform option."
                  },
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "string"
                      },
                      "title": {
                        "type": "string",
                        "description": "Human-readable label for the field."
                      },
                      "description": {
                        "type": "string",
                        "description": "Help text describing the field."
                      },
                      "oneOf": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "const": {
                              "type": "string",
                              "description": "Value submitted when this option is selected."
                            },
                            "title": {
                              "type": "string",
                              "description": "Display label for this option."
                            }
                          },
                          "required": [
                            "const",
                            "title"
                          ],
                          "additionalProperties": false
                        },
                        "description": "Suggested options, each with a value and a display label. The user can also provide a freeform answer."
                      },
                      "default": {
                        "type": "string",
                        "description": "Default value selected when the form is first shown."
                      }
                    },
                    "required": [
                      "type",
                      "oneOf"
                    ],
                    "additionalProperties": false,
                    "description": "Single-select string field with labeled suggestions and a freeform option."
                  },
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "array"
                      },
                      "title": {
                        "type": "string",
                        "description": "Human-readable label for the field."
                      },
                      "description": {
                        "type": "string",
                        "description": "Help text describing the field."
                      },
                      "items": {
                        "type": "object",
                        "properties": {
                          "type": {
                            "type": "string",
                            "const": "string"
                          },
                          "enum": {
                            "type": "array",
                            "items": {
                              "type": "string"
                            },
                            "description": "Values shown in the multi-select."
                          }
                        },
                        "required": [
                          "type",
                          "enum"
                        ],
                        "additionalProperties": false,
                        "description": "Schema applied to each item in the array."
                      },
                      "default": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        },
                        "description": "Default values selected when the form is first shown."
                      }
                    },
                    "required": [
                      "type",
                      "items"
                    ],
                    "additionalProperties": false,
                    "description": "Multi-select string field without a minimum or maximum selection count. The user can also add one freeform value outside the listed options."
                  },
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "array"
                      },
                      "title": {
                        "type": "string",
                        "description": "Human-readable label for the field."
                      },
                      "description": {
                        "type": "string",
                        "description": "Help text describing the field."
                      },
                      "items": {
                        "type": "object",
                        "properties": {
                          "anyOf": {
                            "type": "array",
                            "items": {
                              "type": "object",
                              "properties": {
                                "const": {
                                  "type": "string",
                                  "description": "Value submitted when this option is selected."
                                },
                                "title": {
                                  "type": "string",
                                  "description": "Display label for this option."
                                }
                              },
                              "required": [
                                "const",
                                "title"
                              ],
                              "additionalProperties": false
                            },
                            "description": "Values shown in the multi-select, each with a value and display label."
                          }
                        },
                        "required": [
                          "anyOf"
                        ],
                        "additionalProperties": false,
                        "description": "Schema applied to each item in the array."
                      },
                      "default": {
                        "type": "array",
                        "items": {
                          "type": "string"
                        },
                        "description": "Default values selected when the form is first shown."
                      }
                    },
                    "required": [
                      "type",
                      "items"
                    ],
                    "additionalProperties": false,
                    "description": "Multi-select string field without a minimum or maximum selection count. The user can also add one freeform value outside the listed options."
                  },
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "boolean"
                      },
                      "title": {
                        "type": "string",
                        "description": "Human-readable label for the field."
                      },
                      "description": {
                        "type": "string",
                        "description": "Help text describing the field."
                      },
                      "default": {
                        "type": "boolean",
                        "description": "Default value selected when the form is first shown."
                      }
                    },
                    "required": [
                      "type"
                    ],
                    "additionalProperties": false,
                    "description": "Yes/no field. The user can also provide a freeform answer, so the response may be a string instead of a boolean."
                  },
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "const": "string"
                      },
                      "title": {
                        "type": "string",
                        "description": "Human-readable label for the field."
                      },
                      "description": {
                        "type": "string",
                        "description": "Help text describing the field."
                      },
                      "default": {
                        "type": "string",
                        "description": "Default value populated in the input when the form is first shown."
                      }
                    },
                    "required": [
                      "type"
                    ],
                    "additionalProperties": false,
                    "description": "Free-text string field without length, pattern, or format restrictions."
                  },
                  {
                    "type": "object",
                    "properties": {
                      "type": {
                        "type": "string",
                        "enum": [
                          "number",
                          "integer"
                        ],
                        "description": "Numeric-style field to present. The user may still provide freeform text."
                      },
                      "title": {
                        "type": "string",
                        "description": "Human-readable label for the field."
                      },
                      "description": {
                        "type": "string",
                        "description": "Help text describing the field."
                      },
                      "default": {
                        "type": "number",
                        "description": "Default value populated in the input when the form is first shown."
                      }
                    },
                    "required": [
                      "type"
                    ],
                    "additionalProperties": false,
                    "description": "Numeric-style field without type or range enforcement on the user's response."
                  }
                ],
                "description": "Definition for a single elicitation form field."
              }
            }
          },
          "required": [
            "properties"
          ],
          "additionalProperties": false,
          "description": "A form definition. Field metadata controls presentation but does not constrain the user's response."
        }
      },
      "required": [
        "message",
        "requestedSchema"
      ]
    }
  }
}
```

### 1-2. システムプロンプト内の `<ask_user>` 節（そのまま）

```text
<ask_user>
Use the ask_user tool to ask the user clarifying questions when needed.

**IMPORTANT: Never ask questions via plain text output.** When you need input from the user, use this tool instead of asking in your response text. The tool provides a better UX and ensures the user's answer is captured properly.

This tool presents a structured form to the user. You provide a `message` describing what you need, and a `requestedSchema` defining the form fields. The schema follows JSON Schema conventions — the input_schema for this tool already describes the exact shape.

**When to use this tool:**
- You need the user to make a decision before you can proceed (e.g., choosing between implementation approaches)
- Requirements are ambiguous and you need specific, structured input to resolve them
- You want to collect several related preferences at once rather than asking one at a time
- The user should confirm or override defaults before you act on them

**Choosing field types:**
- **Enum** — when you know likely options (e.g., database engine, auth strategy, log level). The user can still provide a freeform answer. If values are identifiers (snake_case, codes), provide labels via `oneOf: [{const, title}]` so the form is readable.
- **Boolean** — for yes/no decisions (e.g., "enable caching?", "run migrations?")
- **Multi-select array** — when the user may pick any number of values from a known set (e.g., which features to include, which platforms to target). If item values are not human-readable, use `items.anyOf: [{const, title}]` instead of `items.enum`.
- **Number/integer** — for numeric-style configuration (e.g., port, timeout, retry count). The user may still enter freeform text.
- **String** — when the answer is open-ended (e.g., project name, custom path). String answers have no length, pattern, or format restrictions.

**Guidelines:**
- Keep forms focused on one topic — don't mix unrelated questions in a single form
- Provide clear `title` and `description` on each field so the user understands what they're choosing
- Set sensible `default` values when a reasonable default exists — if you recommend a specific option, make it the default
- A single-field form is perfectly fine for a simple yes/no or single choice
- Order `properties` keys in the same sequence you discuss the topics in `message` — the form renders fields in property order, so matching the description avoids forcing the user to jump around

**Example — simple single-choice question:**
```json
{
  "message": "What database should I use?",
  "requestedSchema": {
    "properties": {
      "database": {
        "type": "string",
        "title": "Database engine",
        "enum": ["PostgreSQL", "MySQL", "SQLite"],
        "default": "PostgreSQL"
      }
    }
  }
}
```

**User actions:**
- The user may **accept** the form (you receive their field values)
- The user may **decline** (they chose not to answer — respect this and proceed with reasonable defaults)
- The user may **cancel** (they want to abort the current interaction)

**When to STOP and ask (do not assume):**
- Design decisions that significantly affect implementation approach
- Behavioral questions (e.g., "should this be unlimited or capped?")
- Scope ambiguity (e.g., which features to include/exclude)
- Edge cases where multiple reasonable approaches exist
</ask_user>
```

## 2. SDK の既定（legacy）版：question + choices

取得元：`captures/s1-gpt41-sdk-legacy.tools.json`（Copilot SDK、`onUserInputRequest` を登録、`askUserVariant` 未指定）。

### 2-1. ツール定義

```json
{
  "type": "function",
  "function": {
    "name": "ask_user",
    "description": "Ask the user a question and wait for their response.\nUse this tool when you need to ask the user questions during execution. This allows you to:\n1. Gather user preferences or requirements\n2. Clarify ambiguous instructions\n3. Get decisions on implementation choices as you work\n4. Offer choices to the user about what direction to take",
    "parameters": {
      "type": "object",
      "properties": {
        "question": {
          "type": "string",
          "description": "The question to ask the user. Ensure only one question is asked at a time - do not bundle multiple questions together."
        },
        "choices": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Optional list of choices for a multiple choice question. Prefer providing choices when possible."
        }
      },
      "required": [
        "question"
      ]
    }
  }
}
```

### 2-2. システムプロンプト内の `<ask_user>` 節

```text
<ask_user>
Use the ask_user tool to ask the user clarifying questions when needed.

**IMPORTANT: Never ask questions via plain text output.** When you need input from the user, use this tool instead of asking in your response text. The tool provides a better UX and ensures the user's answer is captured properly.

Guidelines:
- Prefer multiple choice (provide choices array) over freeform for faster UX
- Do NOT include "Other", "Something else", or similar catch-all choices - the UI automatically adds a freeform input option
- Only use pure freeform (no choices) when the answer truly cannot be predicted
- Ask one question at a time - do not batch multiple questions
- Don't ask the questions in bullet points or numbered lists. Ask each question in a clear sentence or paragraph form.
- If you recommend a specific option, make that the first choice and add "(Recommended)" to the label
  Example: choices: ["PostgreSQL (Recommended)", "MySQL", "SQLite"]

Examples:
1. BAD - bundling multiple questions into one and asking the user to confirm or break them apart:
  { "question": "Here's what I'm thinking:\n1. Use PostgreSQL for the database\n2. Add Redis for caching\n3. Use JWT for auth\nDoes this sound good, or would you like to discuss each choice individually?", "choices": ["Sounds good", "Let's discuss individually"] }
  WORKAROUND - ask one focused question per tool call:
  First call:  { "question": "What database should I use?", "choices": ["PostgreSQL", "MySQL", "SQLite"] }
  Second call: { "question": "Should I add Redis for caching?", "choices": ["Yes", "No"] }
  Third call:  { "question": "What auth strategy should I use?", "choices": ["JWT", "Session-based", "OAuth"] }
2. BAD - embedding choices in the question text instead of using the choices field:
  { "question": "What database should I use? (PostgreSQL, MySQL, or SQLite)" }
  WORKAROUND - put the options in the choices array:
  { "question": "What database should I use?", "choices": ["PostgreSQL", "MySQL", "SQLite"] }

When to STOP and ask (do not assume):
- Design decisions that significantly affect implementation approach
- Behavioral questions (e.g., "should this be unlimited or capped?")
- Scope ambiguity (e.g., which features to include/exclude)
- Edge cases where multiple reasonable approaches exist
</ask_user>
```

## 3. モデルに返るツールの結果（実測。原文）

| 操作 | 版 | モデルが受け取る tool の結果 | 取得元 |
| --- | --- | --- | --- |
| 選択肢を選ぶ | legacy | `User selected: Write reports (Recommended)` | logs/s3 |
| 自由入力 | legacy | `User responded: Last Tuesday I wrote a weekly report.` | logs/s3 |
| フォームを確定（2項目） | elicitation（TUI） | `User responded: goal=Review code, lastTime=I write it every Monday.` | logs/i2 |
| 「Other」に自由入力 | elicitation（TUI） | `User responded: Custom tool X` | logs/i4 |
| oneOf（値と表示名）＋ boolean ＋ integer | elicitation（TUI） | `User responded: choice=weekly, ok=true, n=3`（表示名ではなく const の値が返る） | logs/def |
| 複数選択で何も選ばず確定 | elicitation（TUI） | `User accepted but provided no values.` | logs/i3 |
| Esc（cancel） | elicitation（TUI／SDK） | `User cancelled the request.`（手番は続き、モデルに次の呼び出しが行く） | logs/i4, logs/s6 |
| Ctrl+D（decline） | elicitation（TUI／SDK） | `The user is not available to respond and will review your work later. Work autonomously and make good decisions. If the request is genuinely ambiguous or unresolvable, stop and call task_complete summarizing the ambiguity rather than proceeding on an unfounded assumption.`（画面には「Making best guess on autopilot」） | logs/i5, logs/s6 |
| autopilot 中に呼ぶ | elicitation（TUI） | 上の decline と同じ文（ユーザーには聞かれない） | logs/i6-autopilot |
| TUI で legacy の形（question/choices）で呼ぶ | elicitation（TUI） | `Invalid input: This session uses the structured ask_user format. Call ask_user again with {message, requestedSchema}.` | logs/i3 |
| `--no-ask-user` で呼ぶ | — | `Tool 'ask_user' does not exist. Available tools that can be called are bash, read_bash, ... task.` | logs/i8-noask |
| サブエージェント（explore／general-purpose／カスタムエージェント）が呼ぶ | — | `Tool 'ask_user' does not exist.`（カスタムエージェントの tools に ask_user を書いても同じ） | logs/sub1, logs/sub2 |

## 4. 対話モード（TUI）の画面（pyte で端末を再現して取った文字の画面。色・太字は失われる）

### 4-1. 2項目のフォーム（列挙＋自由入力）。最初の項目

```text
 Copilot needs information.
 Let me learn about your job. First, what is the goal?
 [Goal of the job]  Last time you did it
 Goal of the job:
 Pick the closest one
 ❯ Write reports
   Review code
   Answer tickets
   Other (type your answer)
 ↑/↓ select · enter accept · tab next · ctrl+d decline · esc cancel
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

### 4-2. 2つ目の項目（自由入力）に入力したところ

```text
 Copilot needs information.
 Let me learn about your job. First, what is the goal?
  Goal of the job  [Last time you did it]
 Last time you did it
 Describe it freely
 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ❯ I write it every Monday.
 ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 enter accept · shift+tab prev · ctrl+d decline · esc cancel
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

### 4-3. 確定後のタイムライン

```text
 ● Asked user Let me learn about your job. First, what is the goal?                                                                     6s
   │ goal: Review code
   └ lastTime: I write it every Monday.
 ● Thanks, done.
 /tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/cli/proj [⎇ master%]
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
❯
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ← open sidebar · Interactive · Manual Approval · / commands · ? help · tab next tab                                                gpt-4.1
```

### 4-4. 「Other」を選ぶと下に入力欄が出る

```text
 Copilot needs information.
 Q1 enum with other
 Main tool:
   Excel
   Word
   Slack
 ❯ Other (type your answer below)
 ↑/↓ select · enter accept · ctrl+d decline · esc cancel
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
❯ Custom tool X
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

### 4-5. 複数選択（array）

```text
 Copilot needs information.
 Q4 multi-select
 What do you receive?:
 ❯ • Email
   • CSV
   • PDF
   • Other (type your answer)
 ↑/↓ select · space toggle · enter accept · ctrl+d decline · esc cancel
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

### 4-6. default を2番目に置いた oneOf（カーソルが default に合う。特別な「推奨」の印は出ない）。message の Markdown（`**...**`）は文字のまま見えた

```text
 Copilot needs information.
 **Why I ask:** your answer decides the plugin structure.
 Which option fits?
 [How often]  Include examples?   How many people
 How often:
 Pick one; the recommended one is preselected
   Every day
 ❯ Every week (Recommended)
   Every month
   Other (type your answer)
 ↑/↓ select · enter accept · tab next · ctrl+d decline · esc cancel
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```

### 4-7. Ctrl+D（decline）の後

```text
 ● Asked user Waiting for response
   │
   │ Q1 to decline
   │
   └ Making best guess on autopilot
 ● FINISHED-ALL
 /tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/cli/proj [⎇ master%]
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
❯
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 ← open sidebar · Interactive · Manual Approval · / commands · ? help · tab next tab                                                gpt-4.1
```

### 4-8. 2つの ask_user を同時に呼んだ場合（1つずつ順に出る）

```text
 ● Asked user PARALLEL Q1
   └ a1
 ○ Asking user Waiting for response
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
 Copilot needs information.
 PARALLEL Q2
 B:
 ❯ b1
   b2
   Other (type your answer)
 ↑/↓ select · enter accept · ctrl+d decline · esc cancel
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
```
