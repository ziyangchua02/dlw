import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import authRoutes from './src/routes/auth.js'
import moduleRoutes from './src/routes/modules.js'
import submissionRoutes from './src/routes/submissions.js'
import chatRoutes from './src/routes/chat.js'
import teacherRoutes from './src/routes/teacher.js'
import quizRoutes from './src/routes/quiz.js'

const app = express()
const PORT = process.env.PORT || 3001

const allowedOrigins = [
  /^http:\/\/localhost(:\d+)?$/,          // local dev
  /^https:\/\/.*\.vercel\.app$/,          // any Vercel deployment
  /^https:\/\/.*\.up\.railway\.app$/,     // Railway preview URLs
]
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL)  // explicit prod domain
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, same-origin)
    if (!origin) return callback(null, true)
    if (allowedOrigins.some(p => (typeof p === 'string' ? p === origin : p.test(origin)))) {
      return callback(null, true)
    }
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/modules', moduleRoutes)
app.use('/api/submissions', submissionRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/teacher', teacherRoutes)
app.use('/api/quiz', quizRoutes)

app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`)
})
