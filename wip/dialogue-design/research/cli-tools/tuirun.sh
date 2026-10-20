#!/bin/bash
# tuirun.sh <name> <handler> <model> <port> <steps.json> -- <copilot args>
R=/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/cli
C=/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/cp/node_modules/@github/copilot-linux-x64/copilot
name=$1; handler=$2; model=$3; port=$4; steps=$5; shift 6
logdir=$R/logs/$name; home=${HOMEDIR:-$R/homes/$name}
[ -z "$KEEPLOG" ] && rm -rf $logdir
mkdir -p $logdir $home
node $R/logserver.js $port $logdir $handler > $logdir/server.out 2>&1 &
SP=$!; sleep 0.5
base=http://127.0.0.1:$port/v1; [ "$PTYPE" = anthropic ] && base=http://127.0.0.1:$port
cd ${WORKDIR:-$R/proj}
env -u GH_TOKEN -u GITHUB_TOKEN -u COPILOT_GITHUB_TOKEN COPILOT_ALLOW_ALL=true COPILOT_HOME=$home COPILOT_OFFLINE=true \
  COPILOT_PROVIDER_BASE_URL=$base COPILOT_MODEL=$model ${PTYPE:+COPILOT_PROVIDER_TYPE=$PTYPE} ${WIRE:+COPILOT_PROVIDER_WIRE_API=$WIRE} $EXTRAENV \
  timeout ${TMO:-180} python3 $R/tui.py $steps $logdir/tui -- $C "$@"
kill $SP 2>/dev/null
ls $logdir $logdir/tui; cat $logdir/tui/log.json; echo
