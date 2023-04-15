#!/usr/bin/env node

console.log(JSON.stringify({
  envVars: process.env,
  cliArgs: process.argv
}, null, 2))
