"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface QnAItem {
  question: string;
  answer: string;
}

interface QnAProps {
  items: QnAItem[];
}

export function QnA({ items }: QnAProps) {
  return (
    <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-black mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-lg text-black/60 max-w-2xl mx-auto">
            Everything you need to know about our services
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-4">
          {items.map((item, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-white rounded-lg border border-gray-200 px-6 shadow-sm"
            >
              <AccordionTrigger className="text-left hover:no-underline py-6">
                <span className="font-semibold text-black text-lg">
                  {item.question}
                </span>
              </AccordionTrigger>
              <AccordionContent className="text-black/70 leading-relaxed pb-6">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}