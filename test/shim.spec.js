
const crypto = require('node:crypto')
const fsOg = require('node:fs')
const { describe, expect, it } = require('@jest/globals')

function checksumFile (hashName, path) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(hashName)
    const stream = fsOg.createReadStream(path)
    stream.on('error', err => reject(err))
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}
describe('shim.js', () => {
  it('proxies calls and logs info', async () => {
    // we have shim.js and resources/test.js
    // for this test we don't care about the install process, we care about the shim process
    // we will setup a test dir with shim.js and test.js and rename test.js to -> test.js.original
    // shim.js will be renamed test.js, test.js is setup to be directly executable (/usr/bin/env node)
    // after the test we will delete the dir.
    const fs = require('node:fs/promises')
    const path = require('node:path')
    const execSync = require('node:child_process').execSync
    const testPathPrefix = path.join('./test/tmp/', 'proxy-shim')

    await fs.mkdir('./test/tmp/', {
      recursive: true
    })

    const tmpDir = await fs.mkdtemp(testPathPrefix)

    const copyShimProm = fs.copyFile(path.resolve('./src/shim.js'), path.join(tmpDir, 'test.js'))
    const copytestProm = fs.copyFile(path.resolve('./test/resources/test.js'), path.join(tmpDir, 'test.js.original'))
    await Promise.all([copyShimProm, copytestProm])
    const result = JSON.parse(execSync(path.resolve(tmpDir, 'test.js') + ' --test-arg=test', {
      encoding: 'utf-8',
      env: {
        test: 'test',
        ...process.env
      }
    }))
    expect(result.envVars.test).toEqual('test')
    expect(result.cliArgs).toContain('--test-arg=test')
  })
  it('can install', async () => {
    // make a dir
    const fs = require('node:fs/promises')
    const path = require('node:path')
    const execSync = require('node:child_process').execSync
    const testPathPrefix = path.join('./test/tmp/', 'install-shim')

    await fs.mkdir('./test/tmp/', {
      recursive: true
    })
    const tmpDir = await fs.mkdtemp(testPathPrefix)
    // place the shim in it
    const copyShimProm = fs.copyFile(path.resolve('./src/shim.js'), path.join(tmpDir, 'shim.js'))
    const copytestProm = fs.copyFile(path.resolve('./test/resources/test.js'), path.join(tmpDir, 'test.js'))
    await Promise.all([copyShimProm, copytestProm])

    const shimHash = await checksumFile('sha256', path.join(tmpDir, 'shim.js'))
    const testHash = await checksumFile('sha256', path.join(tmpDir, 'test.js'))

    execSync(path.resolve(tmpDir, 'shim.js') + ' --install ' + path.resolve(tmpDir, 'test.js'))
    const newTestHash = await checksumFile('sha256', path.join(tmpDir, 'test.js'))
    const ogHash = await checksumFile('sha256', path.join(tmpDir, 'test.js.original'))

    expect(shimHash).toEqual(newTestHash)
    expect(ogHash).toEqual(testHash)
  })
})
