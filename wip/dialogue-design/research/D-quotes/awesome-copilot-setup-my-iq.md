<!-- awesome-copilot skills/setup-my-iq/SKILL.md @613efc8c: 340-400行(質問), 560-640行(トーン・事前入力・質問・Reaction Pass) -->
- Read each sample for style only: register, sentence length, openings,
  transitions, specific words used or avoided, framing patterns, how they
  handle credit, how they handle bad news.
- Do not copy raw sample text into the file. Extract patterns and present
  them back as proposed bullets in the file's structure.
- Present the proposed draft: "Here's what I extracted. Tell me what's wrong
  or missing."
- Apply the reaction pass as normal.

If the user doesn't share samples (or in addition to them), ask these
questions one at a time:

1. "If a colleague described how you write in one sentence, what would they
   say?"
2. "Read this sentence: *'I'd encourage you to lean into the opportunity to
   be a genuine force multiplier for the team.'* What's wrong with it for
   your voice?" (Surfaces the avoid-list faster than positive questions.)
3. "When you write a weekly status to leadership, what do you wish you could
   automate, and what do you always end up rewriting?"
4. "Who's the hardest audience for you to write to? What changes when you
   write to them?"
5. "When you write about yourself in a Connect or performance review,
   what's a phrase you've caught yourself writing and immediately deleted?"

Draft, present, revise, write.

After writing, tell the user:

> "I won't automatically pick up on patterns over time. If you notice me
> repeating a mistake, swapping phrases, or fighting your edits, ask me to
> update this file and I'll fold the correction in. This file evolves when
> you tell it to."

Transition: "Last one: preferences and constraints. This is how you want AI
to behave around you. Ready?"

### 9. Interview for preferences-and-constraints.md

Load the template from `assets/templates/preferences-and-constraints.md`.

Most rules here are about what an agent shouldn't do unilaterally. Surface
them by recalling concrete frustrations rather than asking for abstract
rules. Ask one question at a time:

1. "When was the last time an AI tool did something you didn't want? What
   did it do, and what should it have done instead?" (One answer often
   produces 3 boundary rules.)
2. "What's safe for an agent to do without asking you? What absolutely
   requires your approval?"
3. "Speed or thoroughness. If you had to pick one, which?"
4. "Are there any decisions you want AI to make for you, or do you always
   want options surfaced?"
5. "Where do you not want an AI speaking on your behalf?" (Teams, email,
   meetings, public chats.)
6. "Do you use any tool with persistent memory (VS Code session memory,
   an agent memory feature, etc.)? If yes, anything you want stored there,
   or specifically not stored there?" Skip the memory section if the
   answer is no.

Draft, present, revise, write. Apply the reaction pass.

Transition: "That's the interview done. Now I'll wire the files into your
custom instructions so every agent can find them."

### 10. Wire the files into a custom instructions file

Add pointer entries to one of the user's custom instructions files so other
skills and agents can find the new files. **Recommend user scope, not
workspace scope.** The whole point of this context is that it's available
everywhere, not tied to one repo.

...

### Tone
Be direct, warm, and specific. You're an interviewer, not a coach. Don't
editorialize, compliment, or offer opinions about the user's answers.

### Pre-fill from available data sources before asking
Before walking the user through a question list, check whether any of your
available tools or data sources can answer the factual fields for you. The
user shouldn't have to type things a connected system already knows.

Common examples (use whatever your environment actually provides):

- A connected work profile or directory may know the user's name, title,
  organization, team, manager, and direct reports — useful for identity.md
  and team.md.
- Calendar, mail, or chat history may surface frequent collaborators and
  recurring cadences — useful for team.md and role-and-responsibilities.md.
- Project management or source control integrations may know the user's
  org/project/area path or repos — useful for tools-systems-and-config.md.
- Existing writing samples in mail or documents (with the user's permission)
  may inform communication-style.md without requiring fresh samples.

Rules:

1. Only use sources the user has already authorized. Don't reach for
   anything new mid-interview without asking.
2. Pre-fill is a proposal, not an answer. Present what you found, label it
   as auto-filled, and ask the user to confirm or correct each value
   before it goes into a file.
3. Don't enumerate tool names to the user. Say something like "I can pull
   some of this from your work profile" rather than listing specific
   product names.
4. Fall back to asking when no source is available, or when the data is
   ambiguous, stale, or sensitive.
5. Open-ended fields (what you actually do, what people come to you for,
   voice, boundaries) still need to be asked. Don't fabricate them from
   indirect signals.

### Questions
- Ask one question at a time. Never present lists of questions.
- Never ask compound questions.
- Use what you learn in earlier files to inform later interviews. Don't
  re-ask things you already know.
- If the user goes on a tangent useful for a later file, note it and use it
  when you get there.
- When the user gives a vague answer, push for specifics: "Can you give me
  an example?" or "What does that actually look like day to day?"
- When you have enough to draft, say so and draft. Don't keep asking. "Enough" means you have answers covering the core fields in that file's template (for identity: name, role, org, team, manager, and what they do). You don't need to walk every listed question if earlier answers already covered the information.

### The Reaction Pass
After drafting each file, present it and say:
"Here's my draft. Read through it and tell me what doesn't sound right.
Anything that feels off, anything I assumed wrong, anything that's missing."

If the user says it looks good with no changes, push once:
"Pick one sentence that's the weakest or most generic. What would make it
more specifically you?"

If they push back a second time and say it's fine, accept it and move on.

### File Quality
- Keep files concise. One page, not five.
- The files should sound like the user, not like an AI writing about them.
- Use their language, their framing, their level of formality.
- Never use em dashes.
- If the user wants to skip a file, let them.
- If the user needs to stop mid-file, tell them where you are so they can
  resume.

---

## Example: Identity Interview Walkthrough

This shows what a complete identity.md interview looks like from first
question through final written file.

**Agent:** What's your name and current role?

**User:** Dana Kim, Senior Program Manager.

**Agent:** What organization are you with, and what team?
