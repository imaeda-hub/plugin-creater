export const meta = {
  name: 'dialogue-design-synthesis',
  description: 'Close Copilot CLI gaps, synthesize research into dialogue design decisions per cluster, then critique',
  phases: [
    { title: 'Gap', detail: 'Copilot CLI experiments with fake model (plugin skill, paste, multi-skill compaction, extension context injection)', model: 'opus' },
    { title: 'Synthesize', detail: '6 clusters: evidence, options, recommendation per design decision', model: 'opus' },
    { title: 'Critique', detail: 'cross-cluster consistency, unsupported claims, constitution/spec conflicts, missing decisions', model: 'opus' },
  ],
}

const R = '/home/user/plugin-creater/wip/dialogue-design'
const S = '/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research'

const COMMON = `
あなたは Agent Plugin のハーネス（スキル、カスタムエージェント、エクステンション、フック）の設計に詳しいハーネスエンジニアである。
リポジトリ /home/user/plugin-creater は読むだけにし、ファイルを変更・コミットしないこと（指定された scratchpad の作業フォルダは除く）。

## 背景
- クリエイター（このリポジトリ）は、GitHub Copilot CLI 1.0.98 向けの Agent Plugin で、ユーザーとの対話でユーザーの仕事のナレッジ（本人には当たり前で、AI が知らないこと）を引き出し、それを組み込んだ「生成プラグイン」を作る。
- 今、「ユーザーと対話してナレッジを引き出す部分」の設計書を作っている。仕様（何を聞くか）はあるが、設計（どう聞くか）がない。これはクリエイターで最も大事な部分である。
- 調査は終わっている。報告は ${R}/research/ にある：
  - 00-context.md（全員の前提と、設計で決めること 1〜11）
  - A-copilot-cli.md と A-appendix-1〜3（Copilot CLI 1.0.98 の事実。偽物のモデルで実際に動かした結果。確信度が高い）
  - B-elicitation-methods.md（人からナレッジを引き出す手法：SWEBOK、ACTA、CDM、laddering、失敗の研究）
  - C-llm-interviewer.md（LLM が聞き手になる研究、公開プロンプトの原文は付録）
  - D-existing-tools.md と D-quotes/（Spec Kit clarify、superpowers、skill-creator、Codex plan、BMAD、awesome-copilot などの聞き取りの手順の原文）
  - E-skill-context-guidance.md（スキルの書き方、長い対話の状態の残し方、モデルごとの違い）
  - RESUME.md（要点のまとめ）
- 上位の文書（必ず読む）：docs/constitution/constitution.md（憲章。最優先）、docs/specs/creation-requirements.md（作る流れの要件。REQ-015〜REQ-024、REQ-026、REQ-027、REQ-032〜REQ-038、REQ-043〜REQ-047、REQ-049）、docs/specs/test-requirements.md（REQ-038）、docs/design/creator-structure.md（スキル make-plugin、メインのエージェント、作業エージェント、3.5 ナレッジの番号と種類）、docs/design/generated-plugin-structure.md の9章（クリエイターの画面と記録のツール）、docs/design/testing.md の4章（Claude Code 向けの置き換え。開発の試験は Claude Code で行い、AskUserQuestion は1〜4問・各2〜4択が必要）と6章（外側の EVAL：ユーザー役の AI で模擬し、ナレッジごとに聞いたか・答えたか・組み込まれたかを記録）。
- ナレッジ：.claude/memory/ の communication.md、knowledge-elicitation.md、user-simulation.md、skills.md、custom-agents.md、kiss.md、plugin-creator-rationale.md。

## 守ること
- 推測で書かない。根拠には、報告のファイル名と節（例：A-copilot-cli.md 3.3）か、報告が引いている一次情報を示す。報告どうしが食い違うときは両方を示す。報告にない主張は「考察」と明記する。
- 憲章 ＞ 仕様書 ＞ 設計書。設計の案が仕様を変える必要があるなら、そう明記する（勝手に仕様を変える前提にしない）。
- KISS（憲章 第10条）：仕様を満たす中で、できるだけ単純な案を推す。
- 設計は、外側の EVAL（testing.md 6章）で確かめられ、Claude Code 向けの置き換え（testing.md 4章）でも動く必要がある。
- ユーザーに決めてもらう問い（question_for_user）は、ファイルを開けないスマートフォンのユーザーにも分かるよう、番号やラベルだけで示さず、中身を平易な日本語で書く。決めないと何が困るか（背景）と具体的な例を1つ添える。選択肢ごとに、選んだときの結果を書く。
- 証拠だけで決まること（仕様や Copilot CLI の事実から一つに決まること）は、needs_user_decision を false にし、理由を書く。好みや方針の選択、証拠が割れているものは true にする。
- 出力はすべて日本語。
`

const DECISION_SCHEMA = {
  type: 'object',
  properties: {
    cluster: { type: 'string' },
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '例: G1-1' },
          title: { type: 'string' },
          related_requirements: { type: 'array', items: { type: 'string' } },
          evidence: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                claim: { type: 'string' },
                source: { type: 'string', description: '報告のファイルと節、または一次情報' },
                strength: { type: 'string', enum: ['high', 'medium', 'low'] },
              },
              required: ['claim', 'source', 'strength'],
            },
          },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                description: { type: 'string' },
                consequences: { type: 'string' },
              },
              required: ['label', 'description', 'consequences'],
            },
          },
          recommendation: { type: 'string' },
          rationale: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          needs_user_decision: { type: 'boolean' },
          why_user_decision_or_not: { type: 'string' },
          question_for_user: { type: 'string', description: '平易な日本語。背景、例、選択肢ごとの結果を含む。needs_user_decision が false なら空でよい' },
          spec_impact: { type: 'string', description: '仕様の変更が要るか。要らなければ「なし」' },
          risks: { type: 'array', items: { type: 'string' } },
          open_items_to_verify: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'title', 'evidence', 'options', 'recommendation', 'rationale', 'confidence', 'needs_user_decision', 'why_user_decision_or_not', 'spec_impact'],
      },
    },
    design_sketch: { type: 'string', description: 'このクラスタの推奨をまとめた、設計書に書く内容の下書き（箇条書き、日本語）' },
    notes: { type: 'string' },
  },
  required: ['cluster', 'decisions', 'design_sketch'],
}

const GAP_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          status: { type: 'string', enum: ['confirmed', 'partial', 'not_done'] },
          result: { type: 'string' },
          how_verified: { type: 'string', description: 'コマンド、ログのパス、または読んだファイルと版' },
          design_implication: { type: 'string', description: '考察として' },
        },
        required: ['question', 'status', 'result', 'how_verified'],
      },
    },
    report_path: { type: 'string' },
  },
  required: ['findings', 'report_path'],
}

const CLUSTERS = [
  { key: 'G1', name: '対話の流れと、ファイルを読んで確かめる進め方', items: `00-context の 1（段階と順番）と 7（ファイルを読んで決まりを推し量る進め方）。
決めること：対話の始まり方（チャットで作業の自動化を頼まれたとき。スキルの description）、段階の順番（項目ごとの質問 REQ-015、実際の1回 REQ-016、ファイル REQ-017、画面で設定したいこと・見たいこと REQ-026、資産 REQ-018、標準機能と公開プラグイン REQ-019、生成前の確認 REQ-020・REQ-027・REQ-038）、「質問の前に読めるものを読む／調べて分かることは聞かない」をどう入れるか、作り直し（REQ-032〜036）の流れの違い。
ファイルについて：Copilot CLI の @ファイル はパスだけを入れ、view は 20KB を超えると読まない（A 6）。ファイルから読み取った決まりの確かめ方（REQ-017 の「〜という決まりですか？」は、はいに偏る：B と C）。「公式のルールと実際のやり方は違う」（B）。`},
  { key: 'G2', name: '質問の形と、分かりやすい伝え方', items: `00-context の 2（質問の形）と 9（伝え方）。
決めること：ask_user を使うか文章で聞くか（Copilot の TUI はフォーム版で複数項目・自由入力・default で推奨。圧縮の後に ask_user の答えは要約にしか残らず、打ったメッセージは原文で残る：A 1、3）。1回に1つか複数か。選択肢を出すか自由回答を先にするか（superpowers は自由回答を先に、Spec Kit は推奨を先頭に：D）。推奨を示すか（誘導の害：B、C）。質問の理由を示すか。ユーザーが断った（Ctrl+D）ときに「ユーザーは不在なので自律で進めよ」が返る問題（A 1）と autopilot・-p・--no-ask-user のときの扱い。Claude Code 向けの置き換え（AskUserQuestion は2〜4択が必要）との両立。専門用語を避ける（REQ-024）、「分からない」への対応。`},
  { key: 'G3', name: '深掘り（聞き直し）と、聞き終える判断', items: `00-context の 3（あいまいさと聞き直し）と 4（聞き漏らしの管理と聞き終える判断）。
決めること：あいまいな答えの見分け方と深掘りの型（ACTA の探りの質問、CDM の実際の1件を数回なぞる、laddering で「どうやって見分けるか」を下にたどる：B。公開プロンプトの規則：C 付録）、深掘りの回数の上限、「分からない」と言われたとき、網羅の確かめ（REQ-015 の10項目のチェックリストと、画面の「まだ聞いていない項目」REQ-043）、聞き終える条件（モデル任せは危ない：C の ReqElicitGym。1人への聞き取りの飽和の研究はない：B）、質問の数とユーザーの疲れ、回を分けるか（チャットは対面の約2倍の時間：B）。`},
  { key: 'G4', name: 'ナレッジの残し方と、効いた質問の記録', items: `00-context の 5（ナレッジの残し方）と 10（どの質問が効いたかの記録）。
決めること：ナレッジの一覧の形（番号と種類：creator-structure 3.5。合否の決め方か、それ以外か）、ユーザーの言葉をどこまで残すか、確かめ方（はい/いいえ は同意に偏る。自分の言葉で言い直してもらう：B。確認の質問は「はい」に偏る：C）、ナレッジの書き方（if-then、決定表、事例と例外：B）、生成前の確認で示す振る舞いの案と、EVAL の課題と合否の基準への変え方（REQ-020、REQ-038）、仕様にない細かさを足さない（testing.md 7章）。
質問の改善（REQ-049）と外側の EVAL（testing.md 6.3）のために、どの質問でどのナレッジが出たか、ユーザーが聞かれる前に話したかをどう記録するか（events.jsonl に ask_user の問いと答えが残る：A 4）。ユーザーの仕事の中身を Issue に書かない（REQ-049）。`},
  { key: 'G5', name: '長い対話の状態の保ち方と、仕事の分け方', items: `00-context の 6（状態の保ち方）と 8（仕事の分け方とモデル）。
決めること：聞き取りの途中経過（決まったナレッジ、聞いた項目、まだの項目、次にすること）をどこに置くか。候補：作業フォルダのファイル、セッションのフォルダ（files/、plan.md）、セッションの SQL、クリエイターのエクステンションの記録（画面の元。generated-plugin-structure 9章）、todo。圧縮で ask_user の答えの原文が消える、最後に呼ばれたスキルは残る、/clear で新しいセッションになる、--resume で戻る（A 2〜4）。圧縮の後や再開の後に、状態を読み直させる方法。
仕事の分け方：ユーザーへの質問はメインのエージェントだけ（サブエージェントは ask_user を持たない：A 7）。ファイルから決まりの候補を洗い出す、公開プラグインを調べる（REQ-019）、ナレッジの一覧と会話の突き合わせ（記録係と点検係の分離が効いた報告：C）をサブエージェントに任せるか、そのモデル（creator-structure 3.1 の推論の重さの分け方、REQ-045）。
※ 同じワークフローの「Gap」の調査結果（プラグインのスキルの読まれ方、エクステンションが毎回の発言に状態を差し込めるか、長い貼り付けなど）が下に付く。必ず使うこと。`},
  { key: 'G6', name: 'いろいろなモデルで手順が守られる SKILL.md の書き方', items: `00-context の 11。
決めること：SKILL.md の組み立て（短い本文と references の分け方：E。Copilot では references はパスだけが入り、モデルが読む：A 2）、先頭に置く最重要の決まり、Copilot CLI のシステムプロンプトとの衝突への対処（gpt-4.1/gpt-5-mini の「あいまいでも進めよ」、gpt-5.5 の「追加の質問をしない」、Claude の「短く」：A 8。モデルごとに聞くか進めるかの既定が逆：E）、「質問が仕事で、答えを待つ」の書き方、手順を途中までしか守らないとスキルなしより悪いという研究（E）、費用の低いモデルは質問を数問に潰しやすい（D）、決まった処理をスクリプトにして状態の更新を確かめる（E）、HARD-GATE や赤信号の表（D の superpowers）、試験（外側の EVAL）で複数のモデルを試すか。
メインのエージェントのモデルはユーザーが選ぶ（REQ-045、README で思考力の高いモデルを勧める REQ-047）。`},
]

phase('Gap')
const gapPromise = agent(`${COMMON}

## あなたの担当（Gap）：Copilot CLI 1.0.98 で、対話の設計の判断に要るのに、まだ確かめていないことを、実際に動かして確かめる

道具：${S}/cli/（使い方は ${R}/research/A-copilot-cli.md の最後の「再開のチェックリスト」。logserver.js、handlers/steps.js、tuirun.sh、sdkrun.sh、run.sh、dump.py。Copilot CLI 1.0.98 は /tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/cp/node_modules/.bin/copilot。展開したパッケージは ${S}/cli/pkg/package/）。ログインはできないので、オフラインのモードで偽物のモデルにつなぐ（COPILOT_OFFLINE=true、COPILOT_PROVIDER_BASE_URL）。作業は ${S}/gap/ の下で行い、ポートはほかとぶつからない番号（18300 番台）を使う。結果を ${S}/gap/GAP-report.md に書く（実験名、コマンド、ログのパス、結果の原文の抜粋）。

確かめること（上から順に。時間がかかりすぎるものは partial で止めてよい）：
1. **プラグインに入れたスキル**：Agent Plugins の形式の最小のプラグイン（作り方は .claude/memory/plugins.md と copilot-cli-testing.md、docs/design/generated-plugin-structure.md 7章のフォルダ構成を参照）に、スキル make-plugin（references/ に別ファイルを1つ）を入れ、--plugin-dir で読み込む。<available_skills> での名前と description、skill ツールで呼んだときの <skill-context> の中身（名前の形、references のパスの並び）を記録する。
2. **エクステンションから状態を毎回の発言に差し込めるか**：Copilot SDK のエクステンションのフック（copilot-sdk の types.d.ts や docs/extensions.md の onUserPromptSubmitted、onPreToolUse、onPostToolUse などに additionalContext や似た仕組みがあるか）を型定義と docs で調べ、あれば --experimental で実際に動かし（前のセッションで、プラグインに入れたエクステンションがオフラインで読み込まれることは確かめ済み：docs/design/generated-plugin-structure.md 11章 #1）、差し込んだ文がモデルへのリクエストのどこに入るか、圧縮の後も毎回入るかを確かめる。フックの出力の形も記録する。読み込みのときの確認が出る場合は、どう許可したかも書く。
3. **ask_user の答えを受けたとき（ユーザーが打ったメッセージではないとき）にも、2 の差し込みが効くか**（onUserPromptSubmitted は ask_user の答えでは呼ばれない可能性がある。呼ばれないなら、ツールの後のフックなど別の差し込み口があるか）。
4. **長い貼り付け**（11行以上）が、モデルに全部送られるか（A 6-4 の未着手）。
5. **2つのスキルを順に呼んだ後に /compact したとき**、<invoked_skills> にいくつ残るか（A の再開のチェックリスト 2）。
6. エクステンションのツールの結果（記録のツールの返り値）が、圧縮の後にどうなるか（ほかのツールの結果と同じく消えるか）。

各項目で、設計への意味（考察）も短く書く。`, { label: 'gap:copilot-cli', phase: 'Gap', schema: GAP_SCHEMA, model: 'opus' })

const clusterPrompt = (c, gap) => `${COMMON}

## あなたの担当（${c.key}）：${c.name}

${c.items}

## やること
1. 上の報告と上位の文書を読む（報告は大きいので、担当に関わる節を grep などで探して読む。ただし、担当の判断に効く事実を見落とさないよう、A・B・C・D・E の5つすべてに当たる）。
2. 担当の論点を、決めること（decision）に分ける（2〜6個程度）。それぞれについて、根拠、選択肢（2〜4個）、推奨、理由、確信度、ユーザーに決めてもらう必要があるか、仕様への影響、リスク、まだ確かめることを出す。
3. 最後に、推奨をまとめた設計書の下書き（design_sketch）を書く。Copilot CLI の事実に依る部分は、どの事実に依るかを書く。
${gap ? `\n## Gap の調査結果（同じワークフローで実際に動かして確かめた結果）\n${JSON.stringify(gap, null, 2)}\n` : ''}`

phase('Synthesize')
const results = await parallel(CLUSTERS.map(c => async () => {
  if (c.key === 'G5') {
    const gap = await gapPromise
    return agent(clusterPrompt(c, gap), { label: `synth:${c.key}`, phase: 'Synthesize', schema: DECISION_SCHEMA, model: 'opus' })
  }
  return agent(clusterPrompt(c, null), { label: `synth:${c.key}`, phase: 'Synthesize', schema: DECISION_SCHEMA, model: 'opus' })
}))
const gap = await gapPromise
const ok = results.filter(Boolean)
log(`synthesized ${ok.length}/6 clusters`)

phase('Critique')
const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          target: { type: 'string', description: 'クラスタや決めることの id' },
          kind: { type: 'string', enum: ['unsupported_claim', 'misread_source', 'constitution_conflict', 'spec_conflict', 'cross_cluster_inconsistency', 'not_testable', 'over_engineering', 'unclear_question', 'other'] },
          problem: { type: 'string' },
          evidence: { type: 'string', description: '確かめた報告や文書の箇所' },
          fix: { type: 'string' },
        },
        required: ['severity', 'target', 'kind', 'problem', 'evidence', 'fix'],
      },
    },
    missing_decisions: { type: 'array', items: { type: 'string' } },
    integrated_flow: { type: 'string', description: '6つの推奨をつないだ対話全体の流れ（矛盾を直した形、日本語の箇条書き）' },
    overall_assessment: { type: 'string' },
  },
  required: ['issues', 'missing_decisions', 'integrated_flow', 'overall_assessment'],
}
const critique = await agent(`${COMMON}

## あなたの担当（点検）：6つのクラスタのまとめを、敵対的に点検する

まとめが正しいと思い込まず、誤りを探す立場で読む。次を確かめる：
1. 根拠の主張が、示された報告の節に本当に書いてあるか（少なくとも、各クラスタの strength が high の根拠と、推奨を支える根拠は、実際に報告のファイルを開いて確かめる）。読み違い、言い過ぎ、報告にない主張を見つける。
2. 憲章・仕様書・既存の設計書と食い違う推奨がないか。仕様の変更が要るのに「なし」としていないか。
3. クラスタどうしの食い違い（例：質問の形の推奨と、状態の残し方の推奨がかみ合っているか。ask_user の答えが圧縮で消えることと、ナレッジの残し方が整合しているか）。
4. 外側の EVAL（testing.md 6章）と Claude Code 向けの置き換え（testing.md 4章）で確かめられるか。
5. KISS に反する作り込みがないか。
6. ユーザーへの問いが、ファイルを開けない人に伝わる平易な日本語になっているか。決める必要のない問いを聞いていないか、逆に、ユーザーが決めるべきことを勝手に決めていないか。
7. 漏れている論点（設計で決めることなのに、どのクラスタも扱っていないもの）。
最後に、矛盾を直した形で、対話全体の流れ（integrated_flow）を書く。

## Gap の調査結果
${JSON.stringify(gap, null, 2)}

## 6つのクラスタのまとめ
${JSON.stringify(ok, null, 2)}
`, { label: 'critique', phase: 'Critique', schema: CRITIC_SCHEMA, model: 'opus' })

return { gap, clusters: ok, critique }
