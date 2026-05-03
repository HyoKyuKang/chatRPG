import { createServer } from 'node:http'
import { readFile, writeFile, readdir, copyFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..', '..')
const nodesDir = join(projectRoot, 'data', 'nodes')
const backupDir = join(projectRoot, 'scripts', 'dev-editor', 'backups')
const reviewsDir = '/tmp'

const REGIONS = [
  'forest-outskirts',
  'forgotten-mountains',
  'ash-wastes',
  'dreaming-city',
  'dawn-spire',
]

const REGION_LABELS = {
  'forest-outskirts': '1. 숲의 외곽',
  'forgotten-mountains': '2. 잊혀진 산맥',
  'ash-wastes': '3. 재의 황무지',
  'dreaming-city': '4. 꿈꾸는 도시',
  'dawn-spire': '5. 새벽의 첨탑',
}

async function loadAllNodes() {
  const result = []
  for (const region of REGIONS) {
    const dir = join(nodesDir, region)
    if (!existsSync(dir)) continue
    const files = await readdir(dir)
    for (const f of files.filter((f) => f.endsWith('.json'))) {
      const path = join(dir, f)
      const raw = await readFile(path, 'utf8')
      try {
        const node = JSON.parse(raw)
        result.push({ ...node, _region: region, _file: f })
      } catch (e) {
        console.error(`Bad JSON in ${path}:`, e.message)
      }
    }
  }
  return result
}

async function loadReviews() {
  const reviews = {}
  for (const region of REGIONS) {
    const path = join(reviewsDir, `reviews-${region}.json`)
    if (!existsSync(path)) continue
    try {
      const raw = await readFile(path, 'utf8')
      const data = JSON.parse(raw)
      Object.assign(reviews, data)
    } catch (e) {
      console.error(`Bad reviews JSON in ${path}:`, e.message)
    }
  }
  return reviews
}

async function saveNode(region, file, body) {
  const path = join(nodesDir, region, file)
  if (!existsSync(path)) throw new Error(`Node not found: ${region}/${file}`)
  // Backup
  if (!existsSync(backupDir)) await mkdir(backupDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  await copyFile(path, join(backupDir, `${file.replace('.json', '')}-${stamp}.json.bak`))
  // Validate JSON
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`)
  }
  await writeFile(path, JSON.stringify(parsed, null, 2) + '\n', 'utf8')
  return parsed
}

function runLint() {
  return new Promise((resolveP) => {
    const proc = spawn('npm', ['run', 'lint:data'], { cwd: projectRoot })
    let out = ''
    let err = ''
    proc.stdout.on('data', (c) => (out += c.toString()))
    proc.stderr.on('data', (c) => (err += c.toString()))
    proc.on('close', (code) => resolveP({ code, stdout: out, stderr: err }))
  })
}

function send(res, status, body, contentType = 'application/json') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

async function readBody(req) {
  return new Promise((resolveP, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolveP(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const path = url.pathname

    // CORS for dev convenience
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return send(res, 204, '')

    // GET / → index.html
    if (req.method === 'GET' && path === '/') {
      const html = await readFile(join(__dirname, 'index.html'), 'utf8')
      return send(res, 200, html, 'text/html; charset=utf-8')
    }

    // GET /api/regions
    if (req.method === 'GET' && path === '/api/regions') {
      return send(res, 200, REGIONS.map((id) => ({ id, label: REGION_LABELS[id] })))
    }

    // GET /api/nodes
    if (req.method === 'GET' && path === '/api/nodes') {
      const nodes = await loadAllNodes()
      return send(res, 200, nodes)
    }

    // GET /api/reviews
    if (req.method === 'GET' && path === '/api/reviews') {
      const reviews = await loadReviews()
      return send(res, 200, reviews)
    }

    // PUT /api/nodes/:region/:file
    const putMatch = path.match(/^\/api\/nodes\/([^/]+)\/([^/]+)$/)
    if (req.method === 'PUT' && putMatch) {
      const [, region, file] = putMatch
      if (!REGIONS.includes(region)) return send(res, 400, { error: 'Invalid region' })
      const body = await readBody(req)
      try {
        const saved = await saveNode(region, file, body)
        return send(res, 200, { ok: true, node: saved })
      } catch (e) {
        return send(res, 400, { error: e.message })
      }
    }

    // POST /api/lint
    if (req.method === 'POST' && path === '/api/lint') {
      const result = await runLint()
      return send(res, 200, result)
    }

    return send(res, 404, { error: 'Not found' })
  } catch (e) {
    console.error(e)
    return send(res, 500, { error: e.message })
  }
})

const PORT = process.env.PORT ? Number(process.env.PORT) : 3030
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  Dev editor running at: http://localhost:${PORT}\n`)
  console.log(`  Project root: ${projectRoot}`)
  console.log(`  Reviews dir:  ${reviewsDir}\n`)
})
