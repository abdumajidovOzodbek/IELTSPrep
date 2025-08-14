# IELTS Computer-Delivered Test Platform

## Overview

This is a full-stack IELTS (International English Language Testing System) computer-delivered test platform built with React + TypeScript frontend and Node.js + Express backend. The application provides a complete testing environment for all four IELTS components: Listening, Reading, Writing, and Speaking. It features AI-powered evaluation using Gemini API for automated scoring and feedback, real-time audio processing, and comprehensive test management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript for type safety and modern development practices
- **Styling**: Tailwind CSS with shadcn/ui component library for consistent UI design
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Build Tool**: Vite for fast development and optimized builds
- **Audio Handling**: Custom audio hooks with HTML5 Audio API for listening test playback

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules for modern JavaScript features
- **Database ORM**: Drizzle ORM with PostgreSQL dialect for type-safe database operations
- **Session Management**: In-memory storage with interface for easy database migration
- **File Handling**: Multer for audio file uploads and processing
- **Rate Limiting**: Express rate limiting for AI API endpoints

### Database Design
- **Users**: Authentication and role management (student, admin, examiner)
- **Test Sessions**: Track test progress, timing, and scores across all four sections
- **Test Questions**: Structured question storage with support for multiple question types
- **Test Answers**: Student response tracking with timing and evaluation data
- **AI Evaluations**: Store automated scoring results from Gemini API
- **Audio Recordings**: Speaking test recordings with transcription support

### AI Integration Architecture
- **Provider Layer**: Configurable AI service layer supporting Gemini API with fallback options
- **Evaluation Engine**: Automated scoring for Writing and Speaking using IELTS band criteria
- **Audio Processing**: Speech-to-text transcription and text-to-speech synthesis
- **Security**: API keys stored server-side only, never exposed to frontend

### Test Flow Architecture
- **Listening**: Audio playback with answer collection and automated transcription-based scoring
- **Reading**: Passage-based questions with AI-generated answer keys and intelligent matching
- **Writing**: Rich text editor with real-time word counting, auto-save, and AI evaluation
- **Speaking**: Audio recording with real-time analysis and AI-powered band scoring

### Authentication & Security
- Session-based authentication with secure cookie handling
- Role-based access control for admin and student features
- API rate limiting to prevent abuse of AI services
- Secure file upload handling with size limits and validation

## External Dependencies

### Core Infrastructure
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for database operations and migrations
- **Session Store**: PostgreSQL session storage with connect-pg-simple

### AI & Machine Learning
- **Primary AI Service**: Google Gemini API for text generation, evaluation, and audio processing
- **Fallback Options**: OpenAI API compatibility layer for alternative AI providers
- **Audio Processing**: Web Speech API and native HTML5 audio support

### Frontend Libraries
- **UI Components**: Radix UI primitives with shadcn/ui styling
- **Form Handling**: React Hook Form with Zod validation
- **Audio Management**: Custom hooks wrapping HTML5 Audio API
- **Date Handling**: date-fns for time formatting and manipulation

### Development Tools
- **Build System**: Vite with React plugin and TypeScript support
- **Styling**: PostCSS with Tailwind CSS and autoprefixer
- **Development**: Replit integration with live reload and error overlay
- **Type Checking**: TypeScript with strict mode enabled

### Production Dependencies
- **File Upload**: Multer for handling multipart form data
- **Security**: Rate limiting middleware for API protection  
- **Validation**: Zod schemas for runtime type checking
- **Error Handling**: Structured error responses with proper HTTP status codes