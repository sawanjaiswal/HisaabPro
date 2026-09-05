import { ArrowLeft, Scale, ShieldCheck, AlertCircle, FileCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { APP_NAME, APP_DOMAIN } from '@/config/app.config'

export function PublicTermsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 px-4 py-8 max-w-3xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800 hover:text-emerald-900"
        >
          <ArrowLeft size={16} /> Back to {APP_NAME}
        </Link>
        <span className="text-xs text-neutral-500">Effective Date: January 1, 2026</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/80 p-6 md:p-8 space-y-6">
        <div className="border-b border-neutral-100 pb-4">
          <div className="flex items-center gap-2 text-emerald-800 mb-2">
            <Scale size={24} />
            <h1 className="text-2xl font-bold tracking-tight">Terms of Service</h1>
          </div>
          <p className="text-sm text-neutral-600">
            Please read these terms carefully before using the {APP_NAME} mobile and web applications.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
            <FileCheck size={18} className="text-emerald-700" /> 1. Services Provided
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {APP_NAME} provides cloud-synchronized billing, GST invoicing, inventory tracking, payment management, and financial reporting tools tailored for Indian businesses and retailers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
            <ShieldCheck size={18} className="text-emerald-700" /> 2. User Responsibilities
          </h2>
          <ul className="list-disc pl-5 text-sm text-neutral-600 space-y-1.5">
            <li>You are responsible for ensuring the accuracy of invoices, tax calculations, and GSTIN numbers entered into the app.</li>
            <li>You must maintain the confidentiality of your PIN and login credentials.</li>
            <li>You agree not to use the service for fraudulent, unlawful, or unauthorized business transactions.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
            <AlertCircle size={18} className="text-emerald-700" /> 3. Limitation of Liability
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            {APP_NAME} provides tax calculations and billing tools as business utilities. We do not provide statutory tax or legal counsel. While we strive for 100% uptime and offline sync reliability, we are not liable for business interruptions or filing penalties incurred due to user configuration errors.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-900">4. Contact Information</h2>
          <p className="text-sm text-neutral-600">
            For questions regarding these terms, reach us at <a href="mailto:support@hisaabpro.in" className="text-emerald-800 underline">support@{APP_DOMAIN}</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
