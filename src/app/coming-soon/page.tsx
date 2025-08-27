import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Coming Soon - netM8",
  description: "AI Agent Platform - Launching Soon",
}

export default function ComingSoonPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-4xl mx-auto text-center">
        {/* Logo/Brand */}
        <div className="mb-8">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
            net<span className="text-blue-500">M8</span>
          </h1>
          <div className="h-1 w-24 bg-blue-500 mx-auto"></div>
        </div>

        {/* Main Message */}
        <div className="mb-12">
          <h2 className="text-2xl md:text-4xl text-gray-300 font-light mb-4">
            AI Agent Platform
          </h2>
          <p className="text-xl text-gray-400">
            Launching Soon
          </p>
        </div>

        {/* Status */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-gray-800/50 backdrop-blur-sm rounded-full px-6 py-3">
            <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
            <span className="text-gray-300">Under Development</span>
          </div>
        </div>

        {/* Features Preview */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
            <div className="text-3xl mb-3">🤖</div>
            <h3 className="text-white font-semibold mb-2">Autonomous Agents</h3>
            <p className="text-gray-400 text-sm">Intelligent AI agents for your workflows</p>
          </div>
          
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-white font-semibold mb-2">Lightning Fast</h3>
            <p className="text-gray-400 text-sm">Powered by Cloudflare Workers edge computing</p>
          </div>
          
          <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-6 border border-gray-700">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="text-white font-semibold mb-2">Secure by Design</h3>
            <p className="text-gray-400 text-sm">Enterprise-grade security and isolation</p>
          </div>
        </div>

        {/* Contact */}
        <div className="text-gray-400">
          <p className="mb-2">For inquiries:</p>
          <a href="mailto:support@netm8.com" className="text-blue-400 hover:text-blue-300 transition-colors">
            support@netm8.com
          </a>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-gray-800">
          <p className="text-gray-500 text-sm">
            © 2025 netM8. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}