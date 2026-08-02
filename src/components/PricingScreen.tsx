"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Sparkles, Zap, Crown, Rocket, Lock, X } from "lucide-react";

import { billing } from "../api";

interface Plan {
  id: string;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: string[];
  limits: { projects: number; [k: string]: any };
  sort_order: number;
}

const easeOut = [0.16, 1, 0.3, 1] as const;

const planIcons: Record<string, any> = {
  free: Sparkles,
  starter: Zap,
  pro: Crown,
  max: Rocket,
};

const planGradients: Record<string, string> = {
  free: "from-gray-400 to-gray-500",
  starter: "from-blue-500 to-cyan-400",
  pro: "from-violet-500 to-purple-500",
  max: "from-amber-500 to-orange-500",
};

interface PricingScreenProps {
  user: any;
  token: string;
  onPlanSelected: (plan: any) => void;
}

export default function PricingScreen({ onPlanSelected }: PricingScreenProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"choose" | "confirm" | "done">("choose");

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    try {
      const data = await billing.plans();
      setPlans(data.plans.filter((p: Plan) => p.id !== "free"));
    } catch {
      setPlans([
        { id: "starter", name: "Starter", description: "For individual developers getting started", price_monthly: 20, price_yearly: 192, features: ["$5 per 5h window", "$20 per week", "Advanced models", "Email support", "5 projects", "1 sandbox", "1 workflow"], limits: { projects: 5 }, sort_order: 1 },
        { id: "pro", name: "Pro", description: "For professional developers who need more", price_monthly: 40, price_yearly: 384, features: ["$10 per 5h window", "$40 per week", "All models", "Priority support", "Unlimited projects", "2 sandboxes", "5 workflows", "Subagents"], limits: { projects: -1 }, sort_order: 2 },
        { id: "max", name: "Max", description: "For power users who need everything", price_monthly: 80, price_yearly: 768, features: ["$20 per 5h window", "$80 per week", "All models + early access", "Dedicated support", "Unlimited projects", "5 sandboxes", "Unlimited workflows", "Subagents", "API access"], limits: { projects: -1 }, sort_order: 3 },
      ]);
    }
  };

  const handleSelect = (planId: string) => {
    setSelected(planId);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    try {
      const data = await billing.updatePlan(selected);
      setStep("done");
      setTimeout(() => onPlanSelected(data.plan), 1800);
    } catch (err) {
      console.error("Failed to update plan:", err);
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selected);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950/80 text-slate-100">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-2xl" aria-hidden="true" />
      <div className="pricing-bg" aria-hidden="true" />

      <div className="pricing-column relative z-10">
        <AnimatePresence mode="wait">
          {step === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col"
            >
              {/* Lock banner */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: easeOut }}
                className="pricing-lock-banner"
              >
                <Lock size={16} />
                <span>Upgrade required to access Kiren</span>
              </motion.div>

              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5, ease: easeOut }}
                className="pricing-header"
              >
                <h1 className="pricing-title">Choose your plan</h1>
                <p className="pricing-subtitle">
                  You need an active plan to use Kiren. Select one below to get started.
                </p>
              </motion.div>

              {/* Billing toggle */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="pricing-toggle-wrap"
              >
                <div className="pricing-toggle">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`pricing-toggle-btn ${billingCycle === "monthly" ? "active" : ""}`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`pricing-toggle-btn ${billingCycle === "yearly" ? "active" : ""}`}
                  >
                    Yearly
                    <span className="pricing-save-badge">Save 20%</span>
                  </button>
                </div>
              </motion.div>

              {/* Plans */}
              <div className="pricing-grid">
                {plans.map((plan, i) => {
                  const Icon = planIcons[plan.id] || Sparkles;
                  const price = billingCycle === "monthly" ? plan.price_monthly : plan.price_yearly;
                  const isPopular = plan.id === "pro";

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 0.25 + i * 0.08, duration: 0.5, ease: easeOut }}
                      onClick={() => handleSelect(plan.id)}
                      className={`pricing-card ${isPopular ? "pricing-card--popular" : ""}`}
                    >
                      {isPopular && (
                        <div className="pricing-popular-badge">Most Popular</div>
                      )}

                      <div className={`pricing-card-icon bg-gradient-to-br ${planGradients[plan.id]}`}>
                        <Icon size={22} className="text-white" />
                      </div>

                      <h3 className="pricing-card-name">{plan.name}</h3>
                      <p className="pricing-card-desc">{plan.description}</p>

                      <div className="pricing-card-price">
                        <span className="pricing-card-amount">
                          {price === 0 ? "Free" : `$${price}`}
                        </span>
                        {price > 0 && (
                          <span className="pricing-card-period">
                            /{billingCycle === "monthly" ? "mo" : "yr"}
                          </span>
                        )}
                      </div>

                      <ul className="pricing-card-features">
                        {plan.features.map((feature, fi) => (
                          <motion.li
                            key={fi}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + fi * 0.04, duration: 0.3 }}
                            className="pricing-feature"
                          >
                            <Check size={14} className="pricing-feature-check" />
                            <span>{feature}</span>
                          </motion.li>
                        ))}
                      </ul>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`pricing-card-btn ${isPopular ? "pricing-card-btn--primary" : ""}`}
                      >
                        Select {plan.name}
                        <ArrowRight size={14} />
                      </motion.button>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === "confirm" && selectedPlan && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.4, ease: easeOut }}
              className="flex flex-1 flex-col items-center justify-center"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: easeOut }}
                className="pricing-confirm-card"
              >
                <button onClick={() => setStep("choose")} className="pricing-confirm-back">
                  <X size={16} />
                </button>

                <div className={`pricing-confirm-icon bg-gradient-to-br ${planGradients[selectedPlan.id]}`}>
                  {(() => {
                    const Icon = planIcons[selectedPlan.id] || Sparkles;
                    return <Icon size={28} className="text-white" />;
                  })()}
                </div>

                <h2 className="pricing-confirm-title">
                  Upgrade to {selectedPlan.name}
                </h2>
                <p className="pricing-confirm-desc">{selectedPlan.description}</p>

                <div className="pricing-confirm-price-box">
                  <div className="pricing-confirm-price-row">
                    <span className="pricing-confirm-billing">
                      {billingCycle === "monthly" ? "Monthly" : "Yearly"} billing
                    </span>
                    <span className="pricing-confirm-amount">
                      ${billingCycle === "monthly" ? selectedPlan.price_monthly : selectedPlan.price_yearly}
                      <span className="pricing-confirm-period">
                        /{billingCycle === "monthly" ? "mo" : "yr"}
                      </span>
                    </span>
                  </div>
                  {billingCycle === "yearly" && selectedPlan.price_yearly > 0 && (
                    <p className="pricing-confirm-savings">
                      You save ${(selectedPlan.price_monthly * 12 - selectedPlan.price_yearly).toFixed(0)} per year
                    </p>
                  )}
                </div>

                <motion.button
                  onClick={handleConfirm}
                  disabled={loading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="pricing-confirm-btn"
                >
                  {loading ? (
                    <span className="pricing-confirm-spinner" />
                  ) : (
                    <>
                      Confirm upgrade
                      <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-1 flex-col items-center justify-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="pricing-done-circle"
              >
                <Check size={40} className="text-white" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="pricing-done-title"
              >
                You're all set!
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="pricing-done-sub"
              >
                Welcome to Kiren {selectedPlan?.name}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
