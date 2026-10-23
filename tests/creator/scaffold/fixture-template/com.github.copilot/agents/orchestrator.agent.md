---
description: "{{plugin_name}} の統括エージェント（試験用のひな形）"
tools:
  - agent
  - read
  - "{{plugin_name}}_plan"
{{orchestrator_extra_tools}}
---

## 作業エージェント

{{worker_agents}}

## 作業ごとの指示

{{slot:orchestrator-task}}
