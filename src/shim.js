#!/usr/bin/env node

const nodePath = require('node:path')
const fs = require('node:fs/promises')
const winston = require('winston')
const spawn = require('node:child_process').spawn
const { tmpdir } = require('node:os')

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.splat(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: nodePath.resolve(tmpdir(), 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: nodePath.resolve(tmpdir(), 'combined.log') })
  ]
})

async function exists (path) {
  try {
    await fs.access(path)
    return true
  } catch (err) {
    return false
  }
}

async function install (path) {
  const target = nodePath.resolve(path)
  if (await exists(target)) {
    logger.info('Moving original to %s.original', target)
    await fs.rename(target, target + '.original')
  }
  logger.info('Installing to %s', path)
  const installedThing = process.argv[0].endsWith('node') ? process.argv[1] : process.argv[0]
  await fs.copyFile(installedThing, target)
}

function nodeIntrepretatorUsed (proc) {
  return proc.argv[0].endsWith('node')
}

function getBinary (proc) {
  const isNodeCalled = nodeIntrepretatorUsed(proc)
  if (isNodeCalled) {
    return proc.argv[1] + '.original'
  } else {
    return proc.argv[0] + '.original'
  }
}

function getArgs (proc) {
  return proc.argv.filter((arg) => !(arg.endsWith('.js') || arg.endsWith('node') ))
}

function shimCall () {
  // we have args
  // we have env
  // we need to pipe std out and std in, but log it
  // we need to return the exit code from the child process
  // the binary should be our name, + .original

  const originalBinary = getBinary(process)
  const args = getArgs(process)
  logger.info('Executing %s with args %s', originalBinary, args)
  const proc = spawn(originalBinary, args, {
    env: process.env,
    shell: false,
    stdio: 'pipe'
  })
  proc.stdout.on('data', (data) => {
    logger.debug('Stdout: %s', data)
    process.stdout.write(data)
  })
  proc.stderr.on('data', (data) => {
    logger.error('Stderr: %s')
    process.stderr.write(data)
  })
  proc.on('error', (err) => {
    logger.error('Proc Error: %s', err)
    process.exit(1337)
  })
  proc.on('exit', (code) => {
    logger.warn('Process exited with %d code', code)
    process.exit(code)
  })
  process.on('SIGINT', proc.kill)
  process.on('SIGTERM', proc.kill)
}

async function run () {
  // check
  if (process.argv.length === 4 && process.argv[2] === '--install') {
    await install(process.argv[3])
  } else {
    shimCall()
  }
}

if (require.main === module) {
  run()
} else {
  module.exports = {
    run,
    shimCall,
    install
  }
}
