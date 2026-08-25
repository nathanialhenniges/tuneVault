/**
 * Fetches the yt-dlp and ffmpeg binaries TuneVault shells out to, into
 * resources/bin/<platform>/. Run once after `npm install`:
 *
 *   npm run download-binaries
 *
 * yt-dlp is PINNED to a known release and its SHA-256 is verified against the
 * checksum file published with that release. That catches truncated or corrupted
 * downloads and keeps builds reproducible. It is not a supply-chain guarantee —
 * the checksum comes from the same host as the binary — but it beats the old
 * script, which pulled an unverified "latest".
 *
 * Keep YTDLP_VERSION current. YouTube changes its player often enough that a
 * yt-dlp more than a few months old stops extracting audio entirely — a stale
 * pin breaks the app just as surely as an unverified download does. To bump:
 * change YTDLP_VERSION, delete resources/bin, and re-run.
 */

import { execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { mkdirSync, existsSync, chmodSync, readFileSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const YTDLP_VERSION = '2026.08.19'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const platform =
  process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'linux'
const binDir = join(root, 'resources', 'bin', platform)
const exe = platform === 'win' ? '.exe' : ''

mkdirSync(binDir, { recursive: true })

const YTDLP_ASSET = { mac: 'yt-dlp_macos', win: 'yt-dlp.exe', linux: 'yt-dlp' }[platform]
const YTDLP_BASE = `https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}`

// ffmpeg static builds. macOS is arm64-only by design: evermeet.cx ships x86_64,
// which trips the "Intel app" warning on Apple Silicon.
const FFMPEG_URL = {
  mac: 'https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip',
  win: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
  linux:
    'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz'
}[platform]

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' })
const curl = (url, dest) => run('curl', ['-fL', '--retry', '3', '-o', dest, url])

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** Pull the expected digest for one asset out of yt-dlp's SHA2-256SUMS file. */
function expectedDigest(sumsPath, asset) {
  for (const line of readFileSync(sumsPath, 'utf-8').split('\n')) {
    const [digest, name] = line.trim().split(/\s+/)
    if (name === asset) return digest
  }
  return null
}

function downloadYtdlp() {
  const dest = join(binDir, `yt-dlp${exe}`)
  if (existsSync(dest)) {
    console.log('yt-dlp already present, skipping.')
    return
  }

  console.log(`Downloading yt-dlp ${YTDLP_VERSION} (${YTDLP_ASSET})...`)
  curl(`${YTDLP_BASE}/${YTDLP_ASSET}`, dest)

  const sums = join(binDir, 'SHA2-256SUMS')
  try {
    curl(`${YTDLP_BASE}/SHA2-256SUMS`, sums)
    const expected = expectedDigest(sums, YTDLP_ASSET)
    const actual = sha256(dest)
    if (!expected) {
      console.warn(`WARNING: ${YTDLP_ASSET} is not listed in SHA2-256SUMS; skipping verification.`)
    } else if (expected !== actual) {
      rmSync(dest, { force: true })
      throw new Error(`checksum mismatch\n  expected ${expected}\n  got      ${actual}`)
    } else {
      console.log('yt-dlp checksum verified.')
    }
  } finally {
    rmSync(sums, { force: true })
  }

  if (platform !== 'win') chmodSync(dest, 0o755)
}

function downloadFfmpeg() {
  const dest = join(binDir, `ffmpeg${exe}`)
  if (existsSync(dest)) {
    console.log('ffmpeg already present, skipping.')
    return
  }

  console.log('Downloading ffmpeg (large)...')
  if (platform === 'mac') {
    const zip = join(binDir, 'ffmpeg.zip')
    curl(FFMPEG_URL, zip)
    run('unzip', ['-o', zip, '-d', binDir])
    rmSync(zip, { force: true })
    chmodSync(dest, 0o755)
  } else if (platform === 'linux') {
    const tar = join(binDir, 'ffmpeg.tar.xz')
    curl(FFMPEG_URL, tar)
    run('tar', ['-xf', tar, '--strip-components=2', '-C', binDir, '--wildcards', '*/bin/ffmpeg'])
    rmSync(tar, { force: true })
    chmodSync(dest, 0o755)
  } else {
    const zip = join(binDir, 'ffmpeg.zip')
    curl(FFMPEG_URL, zip)
    run('powershell', [
      '-command',
      `Expand-Archive -Path '${zip}' -DestinationPath '${binDir}' -Force;` +
        `Get-ChildItem -Path '${binDir}' -Recurse -Filter 'ffmpeg.exe' | Move-Item -Destination '${dest}' -Force;` +
        `Get-ChildItem -Path '${binDir}' -Directory -Filter 'ffmpeg-*' | Remove-Item -Recurse -Force;` +
        `Remove-Item -LiteralPath '${zip}' -Force`
    ])
  }
}

console.log(`\nPlatform: ${platform}\nTarget:   ${binDir}\n`)

try {
  downloadYtdlp()
} catch (err) {
  console.error(`\nyt-dlp download failed: ${err.message}`)
  console.error(`Download ${YTDLP_ASSET} manually from ${YTDLP_BASE} and place it in ${binDir}.`)
}

try {
  downloadFfmpeg()
} catch (err) {
  console.error(`\nffmpeg download failed: ${err.message}`)
  const hint =
    platform === 'mac'
      ? `brew install ffmpeg && ln -s $(which ffmpeg) ${join(binDir, 'ffmpeg')}`
      : platform === 'linux'
        ? `sudo apt install ffmpeg && ln -s $(which ffmpeg) ${join(binDir, 'ffmpeg')}`
        : `choco install ffmpeg, then copy ffmpeg.exe into ${binDir}`
  console.error(`Alternative: ${hint}`)
}

const ok = (name) => (existsSync(join(binDir, name + exe)) ? 'OK' : 'MISSING')
console.log(`\nBinary status:\n  yt-dlp: ${ok('yt-dlp')}\n  ffmpeg: ${ok('ffmpeg')}`)
