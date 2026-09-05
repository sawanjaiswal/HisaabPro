import { ArrowLeft, Shield, Lock, Trash2, Mail, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { APP_NAME, APP_DOMAIN } from '@/config/app.config'

export function PublicPrivacyPage() {
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
            <Shield size={24} />
            <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
          </div>
          <p className="text-sm text-neutral-600">
            Your privacy and the security of your business data are fundamental to {APP_NAME}.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
            <Lock size={18} className="text-emerald-700" /> 1. Information We Collect
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            When you use {APP_NAME}, we collect information necessary to provide billing, inventory management, and tax reporting services:
          </p>
          <ul className="list-disc pl-5 text-sm text-neutral-600 space-y-1.5">
            <li><strong>Account Details:</strong> Phone number, full name, business name, address, and email (optional).</li>
            <li><strong>Business Records:</strong> Customer/Supplier contacts, GSTIN numbers, product catalogues, prices, stock levels, and invoices created by you.</li>
            <li><strong>Device Permissions:</strong> Camera access is requested solely for scanning barcodes and QR codes for quick billing. We do not access photos or cameras without your explicit action.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
            <FileText size={18} className="text-emerald-700" /> 2. How We Use Your Data
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            We use your data strictly to operate and improve {APP_NAME}:
          </p>
          <ul className="list-disc pl-5 text-sm text-neutral-600 space-y-1.5">
            <li>To generate and deliver tax invoices, receipts, and reports.</li>
            <li>To synchronize your offline bills with your cloud account when connected.</li>
            <li>To provide customer support and service notifications.</li>
            <li>We do <strong>not</strong> sell, rent, or monetize your business or customer records to any third party.</li>
          </ul>
        </section>

        <section id="account-deletion" className="space-y-3 bg-red-50/60 p-4 rounded-xl border border-red-200/60">
          <h2 className="text-base font-semibold text-red-900 flex items-center gap-2">
            <Trash2 size={18} className="text-red-700" /> 3. Account & Data Deletion
          </h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            You maintain complete ownership of your data. In compliance with Google Play Developer Policy and data protection regulations, you can delete your account and all associated business data at any time:
          </p>
          <ul className="list-disc pl-5 text-sm text-neutral-700 space-y-1.5">
            <li><strong>In-App Deletion:</strong> Open <em>Settings &rarr; Account &rarr; Delete Account</em> inside the app to initiate instant account termination and data purge.</li>
            <li><strong>Web / Email Request:</strong> Send an email from your registered contact to <a href="mailto:support@hisaabpro.in" className="text-emerald-800 underline font-medium">support@{APP_DOMAIN}</a> with the subject line <code>Account Deletion Request</code>. Your account and transaction history will be purged within 7 business days.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
            <Mail size={18} className="text-emerald-700" /> 4. Contact & Grievance Officer
          </h2>
          <p className="text-sm text-neutral-600 leading-relaxed">
            If you have questions about this privacy policy or our data practices, contact our Data Protection & Grievance team at:
          </p>
          <div className="bg-neutral-100/70 p-3 rounded-lg text-sm text-neutral-800 space-y-1">
            <p><strong>{APP_NAME} Support Team</strong></p>
            <p>Email: <a href="mailto:support@hisaabpro.in" className="text-emerald-800 underline">support@{APP_DOMAIN}</a></p>
            <p>Website: <a href={`https://${APP_DOMAIN}`} target="_blank" rel="noopener noreferrer" className="text-emerald-800 underline">{APP_DOMAIN}</a></p>
          </div>
        </section>
      </div>
    </div>
  )
}
