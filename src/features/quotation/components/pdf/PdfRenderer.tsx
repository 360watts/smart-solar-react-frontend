import { forwardRef } from 'react';
import type { QuotationData } from '../../types/quotation';
import { Slide1Cover } from './Slide1Cover';
import { Slide2Company } from './Slide2Company';
import { SlideQuote } from './SlideQuote';
import { Slide5Terms } from './Slide5Terms';
import { Slide6Charts } from './Slide6Charts';
import { Slide7NextSteps } from './Slide7NextSteps';
import { Slide8App } from './Slide8App';
import { Slide9Reference } from './Slide9Reference';
import { Slide10Thanks } from './Slide10Thanks';

interface Props {
  data: QuotationData;
  slideRefs: React.RefObject<HTMLDivElement>[];
}

export const PdfRenderer = forwardRef<HTMLDivElement, Props>(({ data, slideRefs }, ref) => {
  const slides = [
    <Slide1Cover key="s1" data={data} />,
    <Slide2Company key="s2" />,
    <SlideQuote key="s3" data={data} option={data.optionA} optionLabel="Option A" slideNum={3} />,
    ...(data.optionB ? [<SlideQuote key="s4" data={data} option={data.optionB} optionLabel="Option B" slideNum={4} />] : []),
    <Slide5Terms key="s5" />,
    <Slide6Charts key="s6" data={data} />,
    <Slide7NextSteps key="s7" />,
    <Slide8App key="s8" />,
    <Slide9Reference key="s9" />,
    <Slide10Thanks key="s10" />,
  ];

  return (
    <div
      ref={ref}
      style={{ position: 'fixed', left: -9999, top: 0, width: 1920, zIndex: -1, pointerEvents: 'none' }}
    >
      {slides.map((slide, i) => (
        <div key={i} ref={slideRefs[i]} style={{ width: 1920, height: 1080 }}>
          {slide}
        </div>
      ))}
    </div>
  );
});

PdfRenderer.displayName = 'PdfRenderer';
