'use client';

import { Copy, ArrowLeft } from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { getTransactionById } from '@/lib/actions/transactions';
import { NetworkLogo } from '@/lib/utils/network-logo';
import { extractElectricityToken, formatReceiptDate, formatReceiptTime, getNetworkName, getCableProviderName, getDISCOName, extractPlanDetails } from '@/lib/utils/transaction-helpers';

interface Transaction {
  id: string;
  transaction_id?: string;
  category?: string;
  description?: string;
  phone?: string;
  amount: number;
  status: string;
  created_at: string;
  api_response?: string;
  balance_before?: number;
  balance_after?: number;
  user_id?: string;
  plan_details?: string;
  service_type?: string;
  service_variant?: string;
  service_name?: string;
  service_id?: string;
  metadata?: Record<string, any> | string | null;
}

function ReceiptCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
      <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">
        {title}
      </div>
      <div className="divide-y divide-muted">{children}</div>
    </div>
  );
}

function ReceiptRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 p-2 px-3 text-xs">
      <span className="text-muted-foreground font-medium flex-shrink-0">{label}</span>
      <span className={`font-semibold text-foreground text-right ${mono ? 'font-mono break-all' : ''}`}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: 'SUCCESS' | 'FAILED' }) {
  const tone = status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${tone}`}>{status}</span>;
}

function ReferenceCard({ id, onCopy, copied }: { id: string; onCopy: (text: string) => void; copied: boolean }) {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">
        Reference
      </div>
      <div className="flex items-center justify-between p-4 gap-2">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Transaction ID</div>
          <div className="font-mono text-xs text-foreground">{id}</div>
        </div>
        <button
          onClick={() => onCopy(id)}
          className="flex items-center gap-1 bg-muted text-foreground px-2 py-1 rounded text-xs font-semibold hover:bg-muted/80 transition-colors flex-shrink-0"
        >
          {copied ? 'Copied' : <><Copy className="w-3 h-3" /> Copy</>}
        </button>
      </div>
    </div>
  );
}

export default function TransactionDetailPage() {
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const params = useParams();
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadTransaction() {
      try {
        const result = await getTransactionById(String(params.id));
        if (result.success) {
          setTransaction(result.transaction);
        } else {
          if (result.error === 'Not authenticated') {
            router.push('/login');
            return;
          }
          setError(true);
        }
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) loadTransaction();
  }, [params.id, router]);

  if (loading) {
    // Layout-stable loader: render the same shell (top bar + content area)
    // with a few thin shimmer rows so the page doesn't visually jump when
    // the real receipt arrives.
    return (
      <div className="min-h-screen bg-background">
        <div className="w-full flex flex-col min-h-screen max-w-4xl md:mx-auto">
          <div className="sticky top-0 z-50 bg-background border-b border-muted-foreground/10">
            <div className="flex items-center justify-between p-4 px-4 md:px-6 lg:px-8">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-foreground font-semibold hover:bg-muted p-2 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Receipt</span>
              </button>
            </div>
          </div>
          <div className="flex-1 px-4 md:px-6 lg:px-8 py-6 space-y-4">
            <div className="flex flex-col items-center gap-2 mb-2">
              <div className="w-12 h-12 rounded-full bg-muted animate-pulse" />
              <div className="h-3 w-16 bg-muted rounded animate-pulse" />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                <div className="space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="max-w-md text-center">
          <p className="text-red-600 font-semibold mb-4">Transaction not found</p>
          <button 
            onClick={() => router.back()} 
            className="w-full py-3 bg-primary text-white rounded-lg font-semibold flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const category = transaction.category?.toUpperCase() || '';
  const isAirtime = category === 'AIRTIME';
  const isData = category === 'DATA';
  const isCable = category === 'CABLE';
  const isElectricity = category === 'ELECTRICITY';
  const isWallet = category === 'WALLET_FUND';
  const isExamPins = category === 'EXAM_PINS';
  const isEsim = category === 'ESIM';
  const isBulkSms = category === 'BULK_SMS';
  const isSocial = category === 'SOCIAL';
  const isRechargePins = category === 'RECHARGE_PINS';
  const isSuccess = transaction.status?.toUpperCase() === 'SUCCESS';
  const isFailed = !isSuccess;

  let parsedResponse: any = null;
  if (transaction.api_response) {
    try {
      parsedResponse = typeof transaction.api_response === 'string' 
        ? JSON.parse(transaction.api_response) 
        : transaction.api_response;
    } catch (e) {
      parsedResponse = null;
    }
  }

  const electricityToken = extractElectricityToken(parsedResponse);
  const rechargePins: { pin: string }[] = Array.isArray(parsedResponse?.pins) ? parsedResponse.pins : [];

  let meta: Record<string, any> = {};
  if (transaction.metadata) {
    if (typeof transaction.metadata === 'string') {
      try {
        meta = JSON.parse(transaction.metadata);
      } catch {
        meta = {};
      }
    } else {
      meta = transaction.metadata;
    }
  }

  const formattedDate = formatReceiptDate(transaction.created_at);
  const formattedTime = formatReceiptTime(transaction.created_at);

  // Bulk SMS purchase details (stored in metadata by the bulk-sms action)
  const smsSender = typeof meta.sender === 'string' ? meta.sender : '';
  const smsRecipients = Array.isArray(meta.recipientNumbers) && meta.recipientNumbers.length > 0
    ? meta.recipientNumbers.join(', ')
    : '';
  const smsMessage = typeof meta.message === 'string' ? meta.message : '';

  // Extract network name
  const networkName = getNetworkName(transaction.description || '');
  const cableProvider = getCableProviderName(transaction.description || '');
  const discoName = getDISCOName(transaction.description || '');

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full flex flex-col min-h-screen max-w-4xl md:mx-auto">
        {/* Top Bar - Sticky */}
        <div className="sticky top-0 z-50 bg-background border-b border-muted-foreground/10">
          <div className="flex items-center justify-between p-4 px-4 md:px-6 lg:px-8">
            <button 
              onClick={() => router.back()}
              className="flex items-center gap-2 text-foreground font-semibold hover:bg-muted p-2 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Receipt</span>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 lg:px-8 py-6" ref={receiptRef}>
          {/* FAILED RECEIPT */}
          {isFailed && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <svg viewBox="0 0 24 24" className="w-8 h-8 text-red-600" fill="none" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Transaction Failed</h1>
                <p className="text-sm text-muted-foreground mb-4">Your wallet was not charged</p>
                <p className="text-xs text-muted-foreground line-through">₦{Number(transaction.amount || 0).toLocaleString()}</p>
              </div>

              {/* Service Details Card */}
              {isAirtime && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Service Details</div>
                  <div className="divide-y divide-muted">
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Network</span>
                      <span className="text-sm font-semibold text-foreground">{networkName}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Recipient</span>
                      <span className="text-sm font-semibold text-foreground">{transaction.phone}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Status</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">FAILED</span>
                    </div>
                  </div>
                </div>
              )}

              {isData && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Service Details</div>
                  <div className="divide-y divide-muted">
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Network</span>
                      <span className="text-sm font-semibold text-foreground">{networkName}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Plan</span>
                      <span className="text-sm font-semibold text-foreground">{transaction.plan_details || extractPlanDetails(transaction.description)}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Recipient</span>
                      <span className="text-sm font-semibold text-foreground">{transaction.phone}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Status</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">FAILED</span>
                    </div>
                  </div>
                </div>
              )}

              {isCable && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Service Details</div>
                  <div className="divide-y divide-muted">
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Provider</span>
                      <span className="text-sm font-semibold text-foreground">{cableProvider}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Smart Card</span>
                      <span className="text-sm font-semibold text-foreground">{transaction.phone}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Plan</span>
                      <span className="text-sm font-semibold text-foreground">{transaction.plan_details || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Status</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">FAILED</span>
                    </div>
                  </div>
                </div>
              )}

              {isElectricity && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Service Details</div>
                  <div className="divide-y divide-muted">
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">DISCO</span>
                      <span className="text-sm font-semibold text-foreground">{discoName}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Meter</span>
                      <span className="text-sm font-semibold text-foreground">{transaction.phone}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Status</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">FAILED</span>
                    </div>
                  </div>
                </div>
              )}

              {(isExamPins || isEsim || isBulkSms || isSocial || isRechargePins) && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Service Details</div>
                  <div className="divide-y divide-muted">
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Service</span>
                      <span className="text-sm font-semibold text-foreground">{transaction.service_name || category}</span>
                    </div>
                    {isBulkSms && smsSender && (
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Sender ID</span>
                        <span className="text-sm font-semibold text-foreground">{smsSender}</span>
                      </div>
                    )}
                    {transaction.plan_details && (
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Plan</span>
                        <span className="text-sm font-semibold text-foreground">{transaction.plan_details}</span>
                      </div>
                    )}
                    {isBulkSms && smsRecipients ? (
                      <div className="p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Recipients</span>
                        <p className="text-sm font-semibold text-foreground mt-1 break-words">{smsRecipients}</p>
                      </div>
                    ) : transaction.phone ? (
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Recipient</span>
                        <span className="text-sm font-semibold text-foreground">{transaction.phone}</span>
                      </div>
                    ) : null}
                    {isBulkSms && smsMessage && (
                      <div className="p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Message</span>
                        <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">{smsMessage}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-3 px-4">
                      <span className="text-xs text-muted-foreground font-medium">Status</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">FAILED</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Reference Card */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Reference</div>
                <div className="flex items-center justify-between p-4 gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Transaction ID</div>
                    <div className="font-mono text-xs text-foreground">{transaction.transaction_id || transaction.id}</div>
                  </div>
                  <button 
                    onClick={() => handleCopy(transaction.transaction_id || transaction.id)}
                    className="flex items-center gap-1 bg-muted text-foreground px-2 py-1 rounded text-xs font-semibold hover:bg-muted/80 transition-colors flex-shrink-0"
                  >
                    {copied ? 'Copied' : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS RECEIPTS */}
          {isSuccess && (
            <div className="space-y-4">
              {/* AIRTIME RECEIPT */}
              {isAirtime && (
                <>
                  <div className="flex flex-col items-center gap-2 mb-4">
                    <NetworkLogo network={networkName} size="receipt" page="airtime" />
                    <span className="text-xs font-semibold text-muted-foreground">{networkName}</span>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">Service Details</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Service Type</span>
                        <span className="font-semibold text-foreground">Airtime</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Network</span>
                        <span className="font-semibold text-foreground">{networkName}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Recipient</span>
                        <span className="font-semibold text-foreground">{transaction.phone}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Time</span>
                        <span className="font-semibold text-foreground">{formattedDate}, {formattedTime}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Status</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">SUCCESS</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">Payment</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Charged</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Balance Before</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.balance_before || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Balance After</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.balance_after || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Reference</div>
                    <div className="flex items-center justify-between p-4 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Transaction ID</div>
                        <div className="font-mono text-xs text-foreground">{transaction.transaction_id || transaction.id}</div>
                      </div>
                      <button 
                        onClick={() => handleCopy(transaction.transaction_id || transaction.id)}
                        className="flex items-center gap-1 bg-muted text-foreground px-2 py-1 rounded text-xs font-semibold hover:bg-muted/80 transition-colors flex-shrink-0"
                      >
                        {copied ? 'Copied' : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* DATA RECEIPT */}
              {isData && (
                <>
                  <div className="flex flex-col items-center gap-2 mb-4">
                    <NetworkLogo network={networkName} size="receipt" page="data" />
                    <span className="text-xs font-semibold text-muted-foreground">{networkName}</span>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">Service Details</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Service Type</span>
                        <span className="font-semibold text-foreground">{transaction.service_type || 'Data'}</span>
                      </div>
                      {transaction.service_variant && (
                        <div className="flex items-center justify-between p-2 px-3 text-xs">
                          <span className="text-muted-foreground font-medium">Variant</span>
                          <span className="font-semibold text-foreground">{transaction.service_variant}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Network</span>
                        <span className="font-semibold text-foreground">{networkName}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Plan</span>
                        <span className="font-semibold text-foreground">
                          {transaction.plan_details || extractPlanDetails(transaction.description)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Recipient</span>
                        <span className="font-semibold text-foreground">{transaction.phone}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Time</span>
                        <span className="font-semibold text-foreground">{formattedDate}, {formattedTime}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Status</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">SUCCESS</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">Payment</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Charged</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Balance Before</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.balance_before || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Balance After</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.balance_after || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Reference</div>
                    <div className="flex items-center justify-between p-4 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Transaction ID</div>
                        <div className="font-mono text-xs text-foreground">{transaction.transaction_id || transaction.id}</div>
                      </div>
                      <button 
                        onClick={() => handleCopy(transaction.transaction_id || transaction.id)}
                        className="flex items-center gap-1 bg-muted text-foreground px-2 py-1 rounded text-xs font-semibold hover:bg-muted/80 transition-colors flex-shrink-0"
                      >
                        {copied ? 'Copied' : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* CABLE RECEIPT */}
              {isCable && (
                <>
                  <div className="text-center mb-4">
                    <h3 className="text-sm font-bold text-foreground">{cableProvider}</h3>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">Service Details</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Service Type</span>
                        <span className="font-semibold text-foreground">{transaction.service_type || 'Cable TV'}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Provider</span>
                        <span className="font-semibold text-foreground">{cableProvider}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Package</span>
                        <span className="font-semibold text-foreground">
                          {transaction.plan_details || extractPlanDetails(transaction.description)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Smartcard</span>
                        <span className="font-semibold text-foreground">{transaction.phone}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Time</span>
                        <span className="font-semibold text-foreground">{formattedDate}, {formattedTime}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Status</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">SUCCESS</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">Payment</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Charged</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Balance Before</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.balance_before || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Balance After</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.balance_after || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Service Details</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Service Type</span>
                        <span className="text-sm font-semibold text-foreground">Cable TV</span>
                      </div>
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Provider</span>
                        <span className="text-sm font-semibold text-foreground">{cableProvider}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Smartcard</span>
                        <span className="text-sm font-semibold text-foreground">{transaction.phone}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Status</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">SUCCESS</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Payment</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Amount</span>
                        <span className="text-sm font-semibold text-foreground">₦{Number(transaction.amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Balance Before</span>
                        <span className="text-sm font-semibold text-foreground">₦{Number(transaction.balance_before || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Balance After</span>
                        <span className="text-sm font-semibold text-foreground">₦{Number(transaction.balance_after || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Reference</div>
                    <div className="flex items-center justify-between p-4 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Transaction ID</div>
                        <div className="font-mono text-xs text-foreground">{transaction.transaction_id || transaction.id}</div>
                      </div>
                      <button 
                        onClick={() => handleCopy(transaction.transaction_id || transaction.id)}
                        className="flex items-center gap-1 bg-muted text-foreground px-2 py-1 rounded text-xs font-semibold hover:bg-muted/80 transition-colors flex-shrink-0"
                      >
                        {copied ? 'Copied' : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* ELECTRICITY RECEIPT */}
              {isElectricity && (
                <>
                  <div className="text-center mb-4">
                    <h3 className="text-sm font-bold text-foreground">{discoName || transaction.service_variant || transaction.description || 'Electricity'}</h3>
                  </div>

                  {electricityToken && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden mb-3 p-2">
                      <div className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">⚡ Token</div>
                      <div className="font-mono font-bold text-xs text-blue-900 break-all bg-white p-1.5 rounded text-center">{electricityToken}</div>
                    </div>
                  )}

                  <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">Service Details</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Service Type</span>
                        <span className="font-semibold text-foreground">Electricity</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">DISCO</span>
                        <span className="font-semibold text-foreground">{discoName || transaction.service_variant || transaction.description || 'Electricity'}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Meter Number</span>
                        <span className="font-semibold text-foreground">{transaction.phone}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Time</span>
                        <span className="font-semibold text-foreground">{formattedDate}, {formattedTime}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Status</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">SUCCESS</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">Payment</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Charged</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Balance Before</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.balance_before || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Balance After</span>
                        <span className="font-semibold text-foreground">₦{Number(transaction.balance_after || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {electricityToken && (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden mb-4">
                      <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Token</div>
                      <div className="p-4">
                        <div className="font-mono text-sm text-foreground break-all bg-muted p-3 rounded text-center font-bold tracking-wide">
                          {electricityToken}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Service Details</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Service Type</span>
                        <span className="text-sm font-semibold text-foreground">Electricity</span>
                      </div>
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">DISCO</span>
                        <span className="text-sm font-semibold text-foreground">{discoName || transaction.service_variant || transaction.description || 'Electricity'}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Meter Number</span>
                        <span className="text-sm font-semibold text-foreground">{transaction.phone}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Status</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">SUCCESS</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Payment</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Amount</span>
                        <span className="text-sm font-semibold text-foreground">₦{Number(transaction.amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 px-4">
                        <span className="text-xs text-muted-foreground font-medium">Balance After</span>
                        <span className="text-sm font-semibold text-foreground">₦{Number(transaction.balance_after || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Reference</div>
                    <div className="flex items-center justify-between p-4 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Transaction ID</div>
                        <div className="font-mono text-xs text-foreground">{transaction.transaction_id || transaction.id}</div>
                      </div>
                      <button 
                        onClick={() => handleCopy(transaction.transaction_id || transaction.id)}
                        className="flex items-center gap-1 bg-muted text-foreground px-2 py-1 rounded text-xs font-semibold hover:bg-muted/80 transition-colors flex-shrink-0"
                      >
                        {copied ? 'Copied' : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* EXAM PIN RECEIPT */}
              {isExamPins && (
                <>
                  <div className="text-center mb-4">
                    <h3 className="text-sm font-bold text-foreground">{transaction.service_name || 'Exam Pin'}</h3>
                  </div>

                  <ReceiptCard title="Service Details">
                    <ReceiptRow label="Service Type" value="Exam Pin" />
                    <ReceiptRow label="Board" value={transaction.plan_details || transaction.service_name || '—'} />
                    <ReceiptRow label="Recipient" value={transaction.phone || '—'} />
                    {meta.pin && <ReceiptRow label="PIN" value={String(meta.pin)} mono />}
                    <ReceiptRow label="Time" value={`${formattedDate}, ${formattedTime}`} />
                    <ReceiptRow label="Status" value={<StatusBadge status="SUCCESS" />} />
                  </ReceiptCard>

                  <ReceiptCard title="Payment">
                    <ReceiptRow label="Charged" value={`₦${Number(transaction.amount || 0).toLocaleString()}`} />
                    <ReceiptRow label="Balance Before" value={`₦${Number(transaction.balance_before || 0).toLocaleString()}`} />
                    <ReceiptRow label="Balance After" value={`₦${Number(transaction.balance_after || 0).toLocaleString()}`} />
                  </ReceiptCard>

                  <ReferenceCard id={transaction.transaction_id || transaction.id} onCopy={handleCopy} copied={copied} />
                </>
              )}

              {/* ESIM RECEIPT */}
              {isEsim && (
                <>
                  <div className="text-center mb-4">
                    <h3 className="text-sm font-bold text-foreground">{transaction.service_name || 'eSIM'}</h3>
                  </div>

                  <ReceiptCard title="Service Details">
                    <ReceiptRow label="Service Type" value="eSIM" />
                    <ReceiptRow label="Package" value={transaction.plan_details || transaction.service_name || '—'} />
                    {meta.country && <ReceiptRow label="Country" value={String(meta.country)} />}
                    <ReceiptRow label="Time" value={`${formattedDate}, ${formattedTime}`} />
                    <ReceiptRow label="Status" value={<StatusBadge status="SUCCESS" />} />
                  </ReceiptCard>

                  <ReceiptCard title="Payment">
                    <ReceiptRow label="Charged" value={`₦${Number(transaction.amount || 0).toLocaleString()}`} />
                    <ReceiptRow label="Balance Before" value={`₦${Number(transaction.balance_before || 0).toLocaleString()}`} />
                    <ReceiptRow label="Balance After" value={`₦${Number(transaction.balance_after || 0).toLocaleString()}`} />
                  </ReceiptCard>

                  <ReferenceCard id={transaction.transaction_id || transaction.id} onCopy={handleCopy} copied={copied} />
                </>
              )}

              {/* BULK SMS RECEIPT */}
              {isBulkSms && (
                <>
                  <div className="text-center mb-4">
                    <h3 className="text-sm font-bold text-foreground">Bulk SMS</h3>
                  </div>

                  <ReceiptCard title="Service Details">
                    <ReceiptRow label="Service Type" value="Bulk SMS" />
                    {meta.sender && <ReceiptRow label="Sender" value={String(meta.sender)} />}
                    {meta.recipients !== undefined && <ReceiptRow label="Recipients" value={String(meta.recipients)} />}
                    {meta.pages !== undefined && <ReceiptRow label="Pages" value={String(meta.pages)} />}
                    <ReceiptRow label="Time" value={`${formattedDate}, ${formattedTime}`} />
                    <ReceiptRow label="Status" value={<StatusBadge status="SUCCESS" />} />
                  </ReceiptCard>

                  <ReceiptCard title="Payment">
                    <ReceiptRow label="Charged" value={`₦${Number(transaction.amount || 0).toLocaleString()}`} />
                    <ReceiptRow label="Balance Before" value={`₦${Number(transaction.balance_before || 0).toLocaleString()}`} />
                    <ReceiptRow label="Balance After" value={`₦${Number(transaction.balance_after || 0).toLocaleString()}`} />
                  </ReceiptCard>

                  <ReferenceCard id={transaction.transaction_id || transaction.id} onCopy={handleCopy} copied={copied} />
                </>
              )}

              {/* SOCIAL RECEIPT */}
              {isSocial && (
                <>
                  <div className="text-center mb-4">
                    <h3 className="text-sm font-bold text-foreground">{transaction.service_name || 'Social Media'}</h3>
                  </div>

                  <ReceiptCard title="Service Details">
                    <ReceiptRow label="Service Type" value="Social Media" />
                    <ReceiptRow label="Service" value={transaction.service_name || '—'} />
                    {meta.quantity !== undefined && <ReceiptRow label="Quantity" value={String(meta.quantity)} />}
                    {meta.link && <ReceiptRow label="Link" value={String(meta.link)} mono />}
                    <ReceiptRow label="Time" value={`${formattedDate}, ${formattedTime}`} />
                    <ReceiptRow label="Status" value={<StatusBadge status="SUCCESS" />} />
                  </ReceiptCard>

                  <ReceiptCard title="Payment">
                    <ReceiptRow label="Charged" value={`₦${Number(transaction.amount || 0).toLocaleString()}`} />
                    <ReceiptRow label="Balance Before" value={`₦${Number(transaction.balance_before || 0).toLocaleString()}`} />
                    <ReceiptRow label="Balance After" value={`₦${Number(transaction.balance_after || 0).toLocaleString()}`} />
                  </ReceiptCard>

                  <ReferenceCard id={transaction.transaction_id || transaction.id} onCopy={handleCopy} copied={copied} />
                </>
              )}

              {/* RECHARGE PINS RECEIPT */}
              {isRechargePins && (
                <>
                  <div className="text-center mb-4">
                    <h3 className="text-sm font-bold text-foreground">Recharge Pins</h3>
                  </div>

                  <ReceiptCard title="Service Details">
                    <ReceiptRow label="Service Type" value="Recharge Pins" />
                    <ReceiptRow label="Network" value={(transaction.service_id || '').toUpperCase() || '—'} />
                    <ReceiptRow label="Time" value={`${formattedDate}, ${formattedTime}`} />
                    <ReceiptRow label="Status" value={<StatusBadge status="SUCCESS" />} />
                  </ReceiptCard>

                  {rechargePins.length > 0 && (
                    <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
                      <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">
                        Your Pins ({rechargePins.length})
                      </div>
                      <div className="divide-y divide-muted">
                        {rechargePins.map((p, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 p-2 px-3 text-xs">
                            <span className="text-muted-foreground font-medium">{i + 1}</span>
                            <span className="font-mono font-semibold text-foreground break-all">{p.pin}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <ReceiptCard title="Payment">
                    <ReceiptRow label="Charged" value={`₦${Number(transaction.amount || 0).toLocaleString()}`} />
                    <ReceiptRow label="Balance Before" value={`₦${Number(transaction.balance_before || 0).toLocaleString()}`} />
                    <ReceiptRow label="Balance After" value={`₦${Number(transaction.balance_after || 0).toLocaleString()}`} />
                  </ReceiptCard>

                  <ReferenceCard id={transaction.transaction_id || transaction.id} onCopy={handleCopy} copied={copied} />
                </>
              )}

              {/* WALLET RECEIPT */}
              {isWallet && (
                <>
                  <div className="text-center mb-4">
                    <h3 className="text-sm font-bold text-foreground">Wallet Funding</h3>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">Service Details</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Service Type</span>
                        <span className="font-semibold text-foreground">Wallet Funding</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Method</span>
                        <span className="font-semibold text-foreground">Bank Transfer</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Time</span>
                        <span className="font-semibold text-foreground">{formattedDate}, {formattedTime}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Status</span>
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">SUCCESS</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-hidden mb-3">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-3 py-1.5 border-b border-border uppercase tracking-wider">Funding Details</div>
                    <div className="divide-y divide-muted">
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">Amount Credited</span>
                        <span className="font-semibold text-green-600">+₦{Number(transaction.amount || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between p-2 px-3 text-xs">
                        <span className="text-muted-foreground font-medium">New Balance</span>
                        <span className="font-bold text-foreground">₦{Number(transaction.balance_after || 0).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="text-xs font-bold text-muted-foreground bg-muted px-4 py-2 border-b border-border uppercase tracking-wider">Reference</div>
                    <div className="flex items-center justify-between p-4 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Transaction ID</div>
                        <div className="font-mono text-xs text-foreground">{transaction.transaction_id || transaction.id}</div>
                      </div>
                      <button 
                        onClick={() => handleCopy(transaction.transaction_id || transaction.id)}
                        className="flex items-center gap-1 bg-muted text-foreground px-2 py-1 rounded text-xs font-semibold hover:bg-muted/80 transition-colors flex-shrink-0"
                      >
                        {copied ? 'Copied' : <><Copy className="w-3 h-3" /> Copy</>}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}
