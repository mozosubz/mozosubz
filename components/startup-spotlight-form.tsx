"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react"

interface StartupFormData {
  brandLogo: File | null
  brandName: string
  urlSlug: string
  tagline: string
  description: string
  category: string
  websiteUrl: string
  playStoreLink: string
  iosAppLink: string
}

export function StartupSpotlightForm() {
  const [formData, setFormData] = useState<StartupFormData>({
    brandLogo: null,
    brandName: "Mozosubz",
    urlSlug: "mozosubz",
    tagline: "",
    description: "",
    category: "Other",
    websiteUrl: "https://www.mozosubz.xyz/",
    playStoreLink: "",
    iosAppLink: "",
  })

  const [logoPreview, setLogoPreview] = useState<string>("")
  const [slugError, setSlugError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData({ ...formData, brandLogo: file })
      const reader = new FileReader()
      reader.onload = (event) => {
        setLogoPreview(event.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const validateSlug = (slug: string) => {
    const isValid = /^[a-z0-9-]+$/.test(slug)
    if (!isValid) {
      setSlugError("Lowercase letters, numbers, and hyphens only")
    } else {
      setSlugError("")
    }
    return isValid
  }

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value
    setFormData({ ...formData, urlSlug: slug })
    validateSlug(slug)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateSlug(formData.urlSlug)) {
      return
    }

    if (!formData.brandName.trim() || !formData.tagline.trim() || !formData.description.trim()) {
      alert("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)

    try {
      // Here you would submit to your backend
      console.log("[v0] Submitting startup form:", formData)
      alert("Startup submitted successfully!")
      // Reset form or redirect
    } catch (error) {
      console.error("[v0] Error submitting form:", error)
      alert("Failed to submit startup")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
              G
            </div>
            <span className="text-white font-semibold">Gamms</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-white transition-colors text-sm">
              Search
            </button>
            <button className="text-slate-400 hover:text-white transition-colors">
              🌙
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-6 py-12">
        {/* Section Title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Submit Your Startup</h1>
          <p className="text-slate-400">Share your innovation with the community and get discovered through votes</p>
        </div>

        {/* Logo Upload Section */}
        <div className="mb-8 p-6 rounded-lg border border-slate-700 bg-slate-800/50">
          <label className="block text-white font-semibold mb-4">
            Brand Logo <span className="text-red-400">*</span>Logo preview
          </label>

          <div className="flex gap-6">
            {/* Logo Preview */}
            <div className="w-24 h-24 rounded-lg bg-slate-700 flex items-center justify-center border border-slate-600 flex-shrink-0">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover rounded-lg" />
              ) : (
                <div className="text-slate-500 text-center">
                  <Upload size={24} className="mx-auto mb-1" />
                  <span className="text-xs">Logo</span>
                </div>
              )}
            </div>

            {/* Upload Input */}
            <div className="flex-1">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className="block w-full p-4 border-2 border-dashed border-slate-600 rounded-lg text-center cursor-pointer hover:border-blue-500 transition-colors"
              >
                <p className="text-slate-400 text-sm">Click to upload or drag and drop</p>
                <p className="text-slate-500 text-xs">PNG, JPG, GIF up to 10MB</p>
              </label>
            </div>
          </div>
        </div>

        {/* Brand Name */}
        <div className="mb-6">
          <label className="block text-white font-semibold mb-2">
            Brand Name <span className="text-red-400">*</span>
          </label>
          <Input
            type="text"
            value={formData.brandName}
            onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
            placeholder="Your startup name"
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
          />
        </div>

        {/* URL Slug */}
        <div className="mb-6">
          <label className="block text-white font-semibold mb-2">
            URL Slug <span className="text-red-400">*</span>
          </label>
          <div className="mb-2">
            <Input
              type="text"
              value={formData.urlSlug}
              onChange={handleSlugChange}
              placeholder="mozosubz"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            {!slugError && formData.urlSlug && (
              <>
                <CheckCircle2 size={16} className="text-green-500" />
                <span className="text-green-500">Available</span>
              </>
            )}
            {slugError && (
              <>
                <AlertCircle size={16} className="text-red-400" />
                <span className="text-red-400">{slugError}</span>
              </>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-2">
            Lowercase letters, numbers, and hyphens only. Your page will be at https://gamms.app/spotlight/{formData.urlSlug}
          </p>
        </div>

        {/* Tagline */}
        <div className="mb-6">
          <label className="block text-white font-semibold mb-2">
            Tagline <span className="text-red-400">*</span>
          </label>
          <Input
            type="text"
            value={formData.tagline}
            onChange={(e) => setFormData({ ...formData, tagline: e.target.value.slice(0, 100) })}
            placeholder="A catchy one-liner about your startup"
            maxLength={100}
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
          />
          <p className="text-slate-500 text-xs mt-1">{formData.tagline.length}/100 characters</p>
        </div>

        {/* Description */}
        <div className="mb-6">
          <label className="block text-white font-semibold mb-2">
            Description <span className="text-red-400">*</span>
          </label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value.slice(0, 500) })}
            placeholder="Tell us about your startup, what problem it solves, and what makes it unique"
            maxLength={500}
            rows={6}
            className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500 resize-none"
          />
          <p className="text-slate-500 text-xs mt-1">{formData.description.length}/500 characters</p>
        </div>

        {/* Category */}
        <div className="mb-6">
          <label className="block text-white font-semibold mb-2">
            Category <span className="text-red-400">*</span>
          </label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          >
            <option>Other</option>
            <option>FinTech</option>
            <option>SaaS</option>
            <option>E-commerce</option>
            <option>Healthcare</option>
            <option>Education</option>
            <option>Entertainment</option>
            <option>Social</option>
          </select>
        </div>

        {/* Optional Links */}
        <div className="mb-8 p-6 rounded-lg border border-slate-700 bg-slate-800/50">
          <h3 className="text-white font-semibold mb-4">Optional Links</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Website URL</label>
              <Input
                type="url"
                value={formData.websiteUrl}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                placeholder="https://www.example.com"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">Google Play Store Link</label>
              <Input
                type="url"
                value={formData.playStoreLink}
                onChange={(e) => setFormData({ ...formData, playStoreLink: e.target.value })}
                placeholder="https://play.google.com/store/apps/details?id=..."
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-2">iOS App Store Link</label>
              <Input
                type="url"
                value={formData.iosAppLink}
                onChange={(e) => setFormData({ ...formData, iosAppLink: e.target.value })}
                placeholder="https://apps.apple.com/app/..."
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-slate-600 text-white hover:bg-slate-800"
          >
            Back
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            {isSubmitting ? "Submitting..." : "Submit to Spotlight"}
          </Button>
        </div>

        {/* Footer Links */}
        <div className="mt-8 pt-8 border-t border-slate-700 flex justify-center gap-6 text-sm">
          <a href="#" className="text-slate-400 hover:text-white transition-colors">
            Showcase
          </a>
          <a href="#" className="text-slate-400 hover:text-white transition-colors">
            Leaderboard
          </a>
          <a href="#" className="text-slate-400 hover:text-white transition-colors">
            My Startups
          </a>
          <a href="#" className="text-slate-400 hover:text-white transition-colors">
            Invest
          </a>
        </div>
      </form>
    </div>
  )
}
