import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import appCss from "~/styles/app.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      {
        title: "ReviewReply — AI-Powered Review Responses for Local Businesses",
      },
      {
        name: "description",
        content:
          "Draft fast, professional, personalized responses to Google and Yelp reviews in one click. Boost your local SEO and customer trust with ReviewReply.",
      },
      { name: "theme-color", content: "#0f172a" },
      {
        property: "og:title",
        content: "ReviewReply — Never struggle to reply to a review again",
      },
      {
        property: "og:description",
        content:
          "AI-powered review responses for local businesses. One click. Professional tone. Built for restaurants, dentists, salons, and more.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "ReviewReply — AI-Powered Review Responses",
      },
      {
        name: "twitter:description",
        content:
          "Stop dreading your review inbox. Generate thoughtful, on-brand responses in seconds.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-slate-400">Page not found</p>
     </div>
   </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
   </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <HeadContent />
     </head>
      <body className="bg-slate-50 text-slate-900 antialiased">
        {children}
        <Scripts />
     </body>
   </html>
  );
}
