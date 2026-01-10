# 🚀 AI Video Production Platform - Deployment Guide

Complete guide to deploy this project locally and to production hosting platforms.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
3. [Supabase Backend Setup](#supabase-backend-setup)
4. [Environment Variables](#environment-variables)
5. [Deploy to Vercel](#deploy-to-vercel)
6. [Deploy to Netlify](#deploy-to-netlify)
7. [Post-Deployment Configuration](#post-deployment-configuration)
8. [Troubleshooting](#troubleshooting)

---

## 🔧 Prerequisites

Before starting, ensure you have:

- **Node.js** v18+ installed
- **npm** or **yarn** package manager
- **Supabase** account (free tier is sufficient)
- **Git** installed
- **Vercel** or **Netlify** account (for production deployment)

### Required API Keys

You'll need API keys for these external services:

1. **AtlasCloud AI** - For script analysis (GPT-5.2)
2. **Sora2API** - For video generation
3. **Shotstack** - For video merging

---

## 💻 Local Development Setup

### Step 1: Clone the Repository

```bash
git clone <your-repository-url>
cd <project-directory>
```

### Step 2: Install Dependencies

```bash
npm install
# or
yarn install
```

### Step 3: Create Environment File

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Or create `.env` manually:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Note:** These values will be provided after setting up Supabase (next section).

### Step 4: Run Development Server

```bash
npm run dev
# or
yarn dev
```

The app will be available at `http://localhost:5173`

---

## 🗄️ Supabase Backend Setup

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click **"New Project"**
3. Fill in:
   - Project name: `ai-video-platform` (or your choice)
   - Database password: (save this securely)
   - Region: Choose closest to your users
4. Click **"Create new project"** (takes ~2 minutes)

### Step 2: Run Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Copy entire contents of `supabase-schema.sql`
4. Paste into SQL Editor
5. Click **"Run"** (or press `Ctrl+Enter`)
6. Verify all tables created successfully

**Expected Result:**
```
✅ All 6 tables created
✅ All 3 functions created
✅ All 2 triggers created
✅ All RLS policies enabled
✅ Storage buckets created
```

### Step 3: Deploy Edge Functions

#### Install Supabase CLI

```bash
npm install -g supabase
```

#### Login to Supabase

```bash
supabase login
```

#### Link Project

```bash
supabase link --project-ref your-project-ref
```

**Find your project-ref:**
- Supabase Dashboard → Settings → General → Reference ID

#### Deploy Functions

```bash
supabase functions deploy analyze-script
supabase functions deploy check-merge-status
supabase functions deploy check-scene-status
supabase functions deploy generate-scene
supabase functions deploy manage-api-keys
supabase functions deploy merge-videos
```

**Verify Deployment:**
```bash
supabase functions list
```

### Step 4: Configure Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. Go to **Authentication** → **Email Templates**
4. Set OTP configuration:
   - **OTP Length:** 8 digits
   - **OTP Expiry:** 3600 seconds (1 hour)

**Optional: Enable Google OAuth**
1. **Authentication** → **Providers** → **Google**
2. Enter Google OAuth credentials
3. Copy Callback URL from Supabase
4. Add to Google Cloud Console

### Step 5: Set Edge Function Secrets

```bash
# AtlasCloud AI API Key
supabase secrets set ATLASCLOUD_API_KEY=your-atlascloud-key

# Sora2API Key
supabase secrets set SORA2API_KEY=your-sora2api-key

# Shotstack API Key
supabase secrets set SHOTSTACK_API_KEY=your-shotstack-key
```

**Or set via Dashboard:**
- **Settings** → **Edge Functions** → **Secrets**

### Step 6: Get Supabase Credentials

1. Go to **Settings** → **API**
2. Copy these values:

```
Project URL: https://xxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

3. Add to your `.env` file:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 🌍 Environment Variables

### Development (.env)

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### Production

Same variables, but set in your hosting platform's dashboard (see below).

**⚠️ IMPORTANT:**
- Never commit `.env` to Git
- Use separate projects for development/production
- Rotate keys if accidentally exposed

---

## 🚀 Deploy to Vercel

### Method 1: Vercel CLI

#### Install Vercel CLI

```bash
npm install -g vercel
```

#### Login

```bash
vercel login
```

#### Deploy

```bash
# First deployment
vercel

# Production deployment
vercel --prod
```

#### Set Environment Variables

```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

Or via **Vercel Dashboard:**
1. Go to your project
2. **Settings** → **Environment Variables**
3. Add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Save and redeploy

### Method 2: GitHub Integration

1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click **"New Project"**
4. Import your GitHub repository
5. Configure:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
6. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Click **"Deploy"**

### Vercel Configuration (vercel.json)

Create `vercel.json` in project root:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 🌐 Deploy to Netlify

### Method 1: Netlify CLI

#### Install Netlify CLI

```bash
npm install -g netlify-cli
```

#### Login

```bash
netlify login
```

#### Initialize

```bash
netlify init
```

Follow prompts:
- Create new site
- Build command: `npm run build`
- Deploy directory: `dist`

#### Deploy

```bash
netlify deploy --prod
```

#### Set Environment Variables

```bash
netlify env:set VITE_SUPABASE_URL "your-url"
netlify env:set VITE_SUPABASE_ANON_KEY "your-key"
```

### Method 2: GitHub Integration

1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click **"Add new site"** → **"Import from Git"**
4. Connect GitHub and select repository
5. Configure:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
6. Click **"Advanced"** → **"New variable"**
   - Add `VITE_SUPABASE_URL`
   - Add `VITE_SUPABASE_ANON_KEY`
7. Click **"Deploy site"**

### Netlify Configuration (netlify.toml)

Create `netlify.toml` in project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## ⚙️ Post-Deployment Configuration

### 1. Add Admin Users

After first deployment:

1. **Register your admin account** through the app
2. Go to Supabase **SQL Editor**
3. Run:

```sql
INSERT INTO public.admin_users (email)
VALUES ('your-email@example.com')
ON CONFLICT (email) DO NOTHING;
```

### 2. Configure API Keys

1. Login to the app with admin account
2. Go to **Admin Panel** (accessible only to admin users)
3. Add API keys:
   - **AtlasCloud:** Service name = `atlascloud`
   - **Sora2API:** Service name = `sora2api`
   - **Shotstack:** Service name = `shotstack`

### 3. Test Complete Workflow

1. **Create Project:** Add title, script, select aspect ratio
2. **Analyze Script:** System splits into scenes
3. **Generate Videos:** Each scene generates video (10s each)
4. **Merge Videos:** Drag & drop or auto-upload all scenes
5. **Download:** Final merged video

### 4. Update Auth Callback URLs (if using Google OAuth)

1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add your production domain:
   ```
   https://your-domain.vercel.app
   https://your-domain.netlify.app
   ```

3. Google Cloud Console:
   - Add `https://your-domain.com/**` to Authorized Redirect URIs

---

## 🐛 Troubleshooting

### Build Errors

**Error: Module not found**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**TypeScript errors**
```bash
# Rebuild types
npm run build
```

### Runtime Errors

**"Invalid Supabase URL"**
- Verify `.env` file exists and contains correct values
- Check environment variables in hosting dashboard
- Ensure variables start with `VITE_` prefix

**"Network Error" when calling Edge Functions**
- Verify Edge Functions are deployed: `supabase functions list`
- Check function logs: Supabase Dashboard → Edge Functions → Logs
- Verify CORS headers in functions

**"Row Level Security policy violation"**
- Ensure user is authenticated
- Check RLS policies in SQL Editor
- Verify user_id matches auth.uid()

### API Key Issues

**"Admin access required"**
- Verify email in `admin_users` table
- Check exact email match (case-sensitive)
- Clear browser cache and re-login

**"API key not found"**
- Add keys via Admin Panel
- Check `api_keys` table has entries
- Verify `service_name` matches exactly

### Video Generation Issues

**"Scene generation failed"**
- Check Edge Function logs
- Verify Sora2API key is valid
- Check retry count (max 3 attempts)

**"Merge failed" or "Only X of Y scenes merged"**
- Ensure ALL scenes have `status = 'completed'`
- Check Shotstack logs in Edge Function
- Verify all video URLs are accessible

---

## 📊 Performance Optimization

### Build Optimization

Add to `vite.config.ts`:

```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react', '@radix-ui/react-dialog'],
        }
      }
    }
  }
});
```

### CDN Caching

Configure in hosting platform:
- Cache static assets (JS, CSS, images) for 1 year
- Cache HTML for 1 hour

---

## 🔐 Security Checklist

- [ ] Environment variables set correctly
- [ ] `.env` added to `.gitignore`
- [ ] RLS enabled on all tables
- [ ] Admin users configured
- [ ] API keys stored in Edge Function secrets
- [ ] CORS configured properly
- [ ] Auth callback URLs updated
- [ ] Storage buckets have correct policies

---

## 📞 Support

### Logs & Debugging

**Supabase Logs:**
- Database: **Database** → **Logs**
- Edge Functions: **Edge Functions** → Select function → **Logs**
- Storage: **Storage** → **Logs**

**Browser Console:**
- Press `F12` to open DevTools
- Check Console and Network tabs

**Common Log Locations:**
- Vercel: Project → **Deployments** → Select deployment → **Function Logs**
- Netlify: Site → **Deploys** → Select deploy → **Deploy log**

---

## 🎉 Success Checklist

After deployment, verify:

- [ ] App loads at production URL
- [ ] Can register new account (Email OTP works)
- [ ] Can create new project
- [ ] Script analysis generates scenes
- [ ] Video generation works (check 1 scene)
- [ ] Can merge videos
- [ ] Final video downloads correctly
- [ ] Admin panel accessible (admin users only)

---

## 📝 Notes

### Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **AI Services:** AtlasCloud AI (GPT-5.2), Sora2API, Shotstack
- **State:** Zustand + React Query
- **UI:** shadcn/ui + Radix UI

### Project Structure

```
├── src/
│   ├── components/     # React components
│   ├── pages/          # Route pages
│   ├── lib/            # Utilities (Supabase client, auth)
│   ├── stores/         # Zustand stores
│   └── types/          # TypeScript types
├── supabase/
│   └── functions/      # Edge Functions
├── .env                # Environment variables (local)
├── supabase-schema.sql # Complete database schema
└── DEPLOYMENT.md       # This file
```

### External Dependencies

- **@supabase/supabase-js** - Supabase client
- **react-router-dom** - Routing
- **zustand** - State management
- **@tanstack/react-query** - Server state
- **lucide-react** - Icons
- **sonner** - Toast notifications
- **@hello-pangea/dnd** - Drag & drop (merge page)

---

**🚀 Ready to deploy! Follow the steps above and your AI Video Production Platform will be live.**
