#!/bin/bash
# sdkrun.sh <name> <handler> <port> <configJson-without-port-home>
R=/tmp/claude-0/-home-user-plugin-creater/e6c4d999-c19d-53e0-b7d9-e675bdfafd19/scratchpad/research/cli
name=$1; handler=$2; port=$3; cfgjson=$4
logdir=$R/logs/$name; home=${HOMEDIR:-$R/homes/$name}
[ -z "$KEEPLOG" ] && rm -rf $logdir
mkdir -p $logdir $home
node $R/logserver.js $port $logdir $handler > $logdir/server.out 2>&1 &
SP=$!; sleep 0.5
echo "$cfgjson" | python3 -I -c "
import json,sys; c=json.load(sys.stdin); c.update(port=$port, home='$home', eventsFile='$logdir/events.json'); c.setdefault('cwd','$R/proj'); print(json.dumps(c))" > $logdir/cfg.json
timeout ${TMO:-180} node $R/sdk.mjs $logdir/cfg.json > $logdir/sdk.out 2>&1
echo "exit=$?" >> $logdir/sdk.out
kill $SP 2>/dev/null
ls $logdir; tail -5 $logdir/sdk.out
