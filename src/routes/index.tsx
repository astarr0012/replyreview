import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { sql } from "~/db";

const joinWaitlist = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (typeof data !== "object" || data === null) return { email: "" };
    const obj = data as Record<string, unknown>;
    const email = typeof obj.email === "string" ? obj.email.trim() : "";
    return { email };
  })
  .handler(async ({ data }) => {
    const email = data.email;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false as const, message: "Please enter a valid email." };
    }
    try {
      await sql()`INSERT INTO waitlist (email) VALUES (${email}) ON CONFLICT (email) DO NOTHING`;
      return { ok: true as const, message: "You're on the list. We'll be in touch." };
    } catch (err) {
      console.error("[waitlist] error:", err);
      return { ok: false as const, message: "Something went wrong. Please try again." };
    }
  });

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-dvh overflow-hidden bg-slate-50 text-slate-900">
      <Header />
      <main>
        <Hero />
        <Logos />
        <HowItWorks />
        <Features />
        <Pricing />
        <FAQ />
        <FinalCTA />
     </main>
      <Footer />
   </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-semibold tracking-tight">ReviewReply</span>
       </a>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          <a href="#how-it-works" className="hover:text-slate-900">
            How it works
         </a>
          <a href="#features" className="hover:text-slate-900">
            Features
         </a>
          <a href="#pricing" className="hover:text-slate-900">
            Pricing
         </a>
          <a href="#faq" className="hover:text-slate-900">
            FAQ
         </a>
       </nav>
        <a
          href="#waitlist"
          className="inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Get early access
       </a>
     </div>
   </header>
  );
}

function Logo() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-sm">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
     </svg>
   </span>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-gradient-to-b from-white via-slate-50 to-slate-50"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl"
      >
        <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-emerald-200 to-sky-200 opacity-40 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
     </div>
      <div className="mx-auto max-w-6xl px-6 pb-24 pt-20 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Built for local businesses
         </span>
          <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight text-slate-900 sm:text-6xl">
            Never struggle to reply to a review again.
         </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-slate-600">
            ReviewReply drafts thoughtful, on-brand responses to every Google and
            Yelp review in seconds. Reply faster, rank higher, and turn happy
            customers into your best marketing.
         </p>
          <div id="waitlist" className="mt-10 scroll-mt-24">
            <WaitlistForm />
            <p className="mt-3 text-sm text-slate-500">
              Free during early access. No credit card required.
           </p>
         </div>
       </div>
        <HeroPreview />
     </div>
   </section>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ kind: "loading" });
    const result = await joinWaitlist({ data: { email } });
    if (result.ok) {
      setStatus({ kind: "success", message: result.message });
      setEmail("");
    } else {
      setStatus({ kind: "error", message: result.message });
    }
  }

  if (status.kind === "success") {
    return (
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800 shadow-sm">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 flex-shrink-0"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
       </svg>
        <span className="text-sm font-medium">{status.message}</span>
     </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-md flex-col gap-2 sm:flex-row"
    >
      <label htmlFor="email" className="sr-only">
        Email address
     </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@yourbusiness.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="flex-1 rounded-full border border-slate-300 bg-white px-5 py-3 text-base text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      />
      <button
        type="submit"
        disabled={status.kind === "loading"}
        className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
      >
        {status.kind === "loading" ? "Joining…" : "Join the waitlist"}
     </button>
      {status.kind === "error" && (
        <p className="mt-1 text-sm text-red-600" role="alert">
          {status.message}
       </p>
      )}
   </form>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl">
      <div
        aria-hidden="true"
        className="absolute -inset-x-6 -top-6 -bottom-6 rounded-[2rem] bg-gradient-to-tr from-emerald-100/60 via-sky-100/40 to-transparent blur-2xl"
      />
      <div className="relative grid gap-4 rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-900/10 sm:p-5 md:grid-cols-2">
        <ReviewCard
          platform="Google"
          author="Sarah M."
          rating={5}
          text={
            "Absolutely love this place! The staff was friendly, the food came out fast, and the patio is gorgeous. Will definitely be back!"
          }
        />
        <ReplyCard
          platform="Google"
          text={
            "Thank you so much, Sarah! We're thrilled you enjoyed the patio and that our team took good care of you. We can't wait to welcome you back. Your favorite table will be ready next time! 🌿"
          }
        />
        <ReviewCard
          platform="Yelp"
          author="James R."
          rating={2}
          text={
            "Service was slow and we had to ask twice for water. Food was fine when it arrived."
          }
        />
        <ReplyCard
          platform="Yelp"
          text={
            "James, I'm sorry your visit didn't go the way it should have. A long wait and missed refills aren't our standard, and I'd love to make it right. Please reach out to me directly at hello@yourbusiness.com. We would love the chance to make your next visit better."
          }
        />
     </div>
   </div>
  );
}

function ReviewCard(props: {
  platform: "Google" | "Yelp";
  author: string;
  rating: number;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700">
            {props.author
              .split(" ")
              .map((s) => s[0])
              .join("")
              .slice(0, 2)}
         </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">
              {props.author}
           </div>
            <Stars rating={props.rating} />
         </div>
       </div>
        <PlatformBadge platform={props.platform} />
     </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">{props.text}</p>
   </div>
  );
}

function ReplyCard(props: { platform: "Google" | "Yelp"; text: string }) {
  return (
    <div className="relative rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
      <div className="absolute -top-2 right-4 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
        AI draft
     </div>
      <div className="flex items-center gap-2">
        <PlatformBadge platform={props.platform} />
        <span className="text-xs font-medium text-emerald-800">Your reply</span>
     </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-800">{props.text}</p>
   </div>
  );
}

function PlatformBadge({ platform }: { platform: "Google" | "Yelp" }) {
  if (platform === "Google") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
        <span className="grid h-3 w-3 place-items-center rounded-full bg-[#4285F4] text-[8px] font-bold text-white">
          G
       </span>
        Google
     </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
      <span className="grid h-3 w-3 place-items-center rounded-full bg-[#d32323] text-[7px] font-bold text-white">
        Y
     </span>
      Yelp
   </span>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <div
      className="flex items-center gap-0.5 text-amber-400"
      aria-label={`${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill={i <= rating ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          className={`h-3.5 w-3.5 ${i > rating ? "text-slate-300" : ""}`}
          aria-hidden="true"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
       </svg>
      ))}
   </div>
  );
}

function Logos() {
  const labels = [
    "Restaurants",
    "Dental practices",
    "Auto shops",
    "Salons & spas",
    "Plumbers & HVAC",
    "Boutique retail",
  ];
  return (
    <section className="border-y border-slate-200/70 bg-white py-10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
          Trusted by local businesses across every category
       </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-slate-400">
          {labels.map((label) => (
            <span
              key={label}
              className="text-sm font-semibold tracking-tight text-slate-500"
            >
              {label}
           </span>
          ))}
       </div>
     </div>
   </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      title: "Paste your review",
      desc: "Drop a Google or Yelp review into ReviewReply, or let us auto-sync new reviews as they come in.",
      icon: ClipboardIcon,
    },
    {
      title: "AI drafts a reply",
      desc: "Our model writes a warm, professional response in your chosen tone — and tailored to your business.",
      icon: SparkleIcon,
    },
    {
      title: "Approve & post",
      desc: "Edit if you want, then publish directly to Google or Yelp. Or copy it out in one click.",
      icon: CheckIcon,
    },
  ];
  return (
    <section id="how-it-works" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
            How it works
         </p>
          <h2 className="mt-3 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            From new review to published reply in under a minute.
         </h2>
          <p className="mt-4 text-pretty text-lg text-slate-600">
            No more staring at a blank reply box. No more copy-pasted templates
            that customers can spot a mile away.
         </p>
       </div>
        <ol className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-base font-semibold text-white">
                    {i + 1}
                 </span>
                  <Icon className="h-6 w-6 text-emerald-600" />
               </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">
                  {step.title}
               </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {step.desc}
               </p>
             </li>
            );
          })}
       </ol>
     </div>
   </section>
  );
}

function Features() {
  const features = [
    {
      title: "One-click review import",
      desc: "Paste a review, forward an email, or auto-sync from Google and Yelp. Stop juggling tabs.",
      icon: InboxIcon,
    },
    {
      title: "Tone control",
      desc: "Pick the voice — warm and friendly, polished and professional, or punchy and apologetic. Match every reply to your brand.",
      icon: SlidersIcon,
    },
    {
      title: "Brand voice customization",
      desc: "Train ReviewReply on your existing replies so every draft sounds like you on your best day.",
      icon: MegaphoneIcon,
    },
    {
      title: "Google & Yelp support",
      desc: "Drafts are formatted and platform-aware, with the right length and style for each.",
      icon: GlobeIcon,
    },
    {
      title: "Response history",
      desc: "Every reply, searchable and sortable. Spot patterns in what your customers love (and what they don't).",
      icon: ClockIcon,
    },
    {
      title: "Built for teams",
      desc: "Multi-location support, shared brand voice, and roles for managers. Agency plan coming soon.",
      icon: UsersIcon,
    },
  ];
  return (
    <section
      id="features"
      className="scroll-mt-20 bg-white py-24"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
            Features
         </p>
          <h2
            id="features-heading"
            className="mt-3 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl"
          >
            Everything you need to never let a review go unanswered.
         </h2>
          <p className="mt-4 text-pretty text-lg text-slate-600">
            Built specifically for the way local businesses actually respond —
            not a generic AI chat box.
         </p>
       </div>
        <ul className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <li
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 transition hover:border-emerald-200 hover:bg-white hover:shadow-md"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Icon className="h-5 w-5" />
               </span>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {feature.title}
               </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {feature.desc}
               </p>
             </li>
            );
          })}
       </ul>
     </div>
   </section>
  );
}

type Plan = {
  id: "starter" | "pro" | "agency";
  name: string;
  price: string;
  cadence: string;
  description: string;
  responses: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  badge?: string;
};

function Pricing() {
  const plans: Plan[] = [
    {
      id: "starter",
      name: "Starter",
      price: "$19",
      cadence: "per month",
      description: "For solo owners just starting to reply like a pro.",
      responses: "30 responses / month",
      features: [
        "Manual review import",
        "Tone presets (friendly, professional, apologetic)",
        "Google & Yelp formatting",
        "Response history",
      ],
      cta: "Start with Starter",
    },
    {
      id: "pro",
      name: "Pro",
      price: "$39",
      cadence: "per month",
      description: "For busy owners who want every reply on autopilot.",
      responses: "100 responses / month",
      features: [
        "Everything in Starter",
        "Auto-sync with Google & Yelp APIs",
        "Custom brand voice training",
        "Multi-user access",
      ],
      cta: "Go Pro",
      highlighted: true,
      badge: "Most popular",
    },
    {
      id: "agency",
      name: "Agency",
      price: "$99",
      cadence: "per month",
      description: "For agencies and multi-location operators.",
      responses: "500 responses / month",
      features: [
        "Everything in Pro",
        "Multi-location management",
        "White-label option",
        "Priority support",
      ],
      cta: "Talk to us",
    },
  ];
  return (
    <section id="pricing" className="scroll-mt-20 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
            Pricing
         </p>
          <h2 className="mt-3 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Simple plans that pay for themselves.
         </h2>
          <p className="mt-4 text-pretty text-lg text-slate-600">
            One thoughtful reply can win back a customer — and a few of them a
            month covers your subscription many times over.
         </p>
       </div>
        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
       </div>
        <p className="mt-8 text-center text-sm text-slate-500">
          All plans include a 7-day free trial. Cancel anytime.
       </p>
     </div>
   </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  if (plan.highlighted) {
    return (
      <div className="relative rounded-3xl border-2 border-emerald-500 bg-slate-900 p-8 text-white shadow-xl">
        {plan.badge && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow">
              {plan.badge}
           </span>
         </div>
        )}
        <h3 className="text-xl font-semibold">{plan.name}</h3>
        <p className="mt-2 text-sm text-slate-300">{plan.description}</p>
        <div className="mt-6 flex items-baseline gap-1">
          <span className="text-5xl font-bold tracking-tight">{plan.price}</span>
          <span className="text-sm text-slate-300">/ {plan.cadence}</span>
       </div>
        <p className="mt-1 text-sm font-medium text-emerald-300">
          {plan.responses}
       </p>
        <ul className="mt-6 space-y-3 text-sm">
          {plan.features.map((f) => (
            <li key={f} className="flex items-start gap-3">
              <CheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
              <span className="text-slate-100">{f}</span>
           </li>
          ))}
       </ul>
        <a
          href="#waitlist"
          className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-emerald-500 px-5 py-3 text-base font-semibold text-white shadow transition hover:bg-emerald-400"
        >
          {plan.cta}
       </a>
     </div>
    );
  }
  return (
    <div className="flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <h3 className="text-xl font-semibold text-slate-900">{plan.name}</h3>
      <p className="mt-2 text-sm text-slate-600">{plan.description}</p>
      <div className="mt-6 flex items-baseline gap-1">
        <span className="text-5xl font-bold tracking-tight text-slate-900">
          {plan.price}
       </span>
        <span className="text-sm text-slate-500">/ {plan.cadence}</span>
     </div>
      <p className="mt-1 text-sm font-medium text-emerald-700">
        {plan.responses}
     </p>
      <ul className="mt-6 space-y-3 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <CheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
            <span className="text-slate-700">{f}</span>
         </li>
        ))}
     </ul>
      <a
        href="#waitlist"
        className="mt-8 inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
      >
        {plan.cta}
     </a>
   </div>
  );
}

function FAQ() {
  const faqs = [
    {
      q: "Will the replies sound like a robot?",
      a: "No. ReviewReply is tuned for warm, human-sounding responses — and on the Pro plan it learns your own voice from your past replies, so drafts sound like you on your best day.",
    },
    {
      q: "Do you auto-post to Google or Yelp?",
      a: "You stay in control. Every draft lands in your queue for a quick review, then you approve before it posts. We never send a reply without your say-so.",
    },
    {
      q: "What if a review is in another language?",
      a: "ReviewReply detects the language and replies in kind — French review, French reply — with the same tone control and brand voice.",
    },
    {
      q: "Can I cancel anytime?",
      a: "Yes — cancel from your dashboard in two clicks. You'll keep access through the end of your billing period.",
    },
  ];
  return (
    <section id="faq" className="scroll-mt-20 bg-white py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
            FAQ
         </p>
          <h2 className="mt-3 text-balance text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Questions, answered.
         </h2>
       </div>
        <dl className="mt-12 space-y-4">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl border border-slate-200 bg-slate-50/60 p-6 open:bg-white open:shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-slate-900">
                <span>{item.q}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5 flex-shrink-0 text-slate-400 transition group-open:rotate-180"
                  aria-hidden="true"
                >
                  <path d="m6 9 6 6 6-6" />
               </svg>
             </summary>
              <dd className="mt-3 text-sm leading-relaxed text-slate-600">
                {item.a}
             </dd>
           </details>
          ))}
       </dl>
     </div>
   </section>
  );
}

function FinalCTA() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 px-8 py-16 text-center shadow-xl sm:px-16">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-0 bg-gradient-to-tr from-emerald-500/20 via-transparent to-sky-500/20"
          />
          <div className="relative">
            <h2 className="text-balance text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Your next review deserves a great reply.
           </h2>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-lg text-slate-300">
              Join the waitlist and be first in line when early access opens.
           </p>
            <a
              href="#waitlist"
              className="mt-8 inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-base font-semibold text-white shadow transition hover:bg-emerald-400"
            >
              Get early access
           </a>
         </div>
       </div>
     </div>
   </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            ReviewReply
         </span>
       </div>
        <p className="text-sm text-slate-500">
          Built with{" "}
          <a
            href="https://cto.new"
            className="font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            cto.new
         </a>
       </p>
     </div>
   </footer>
  );
}

/* ---------- Icons (inline, no extra deps) ---------- */

function ClipboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
   </svg>
  );
}
function SparkleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M6.2 6.2 4 4M20 20l-2.2-2.2M6.2 17.8 4 20M20 4l-2.2 2.2" />
      <circle cx="12" cy="12" r="3" />
   </svg>
  );
}
function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
   </svg>
  );
}
function InboxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
   </svg>
  );
}
function SlidersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="2" x2="6" y1="14" y2="14" />
      <line x1="10" x2="14" y1="8" y2="8" />
      <line x1="18" x2="22" y1="16" y2="16" />
   </svg>
  );
}
function MegaphoneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 11l18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
   </svg>
  );
}
function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
   </svg>
  );
}
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
   </svg>
  );
}
function UsersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
   </svg>
  );
}
