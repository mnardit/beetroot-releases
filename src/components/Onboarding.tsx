import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { IconSparkles, IconKeyboard, IconSearch, IconWand, IconRocket } from "@tabler/icons-react";
import { useTranslation } from "../lib/i18n";
import { displayHotkey } from "../lib/hotkey-utils";
import { useFocusTrap } from "../hooks/useFocusTrap";
import "../styles/Onboarding.css";

const stepIcons: ReactNode[] = [
  <IconSparkles key="step1" size={32} />,
  <IconKeyboard key="step2" size={32} />,
  <IconSearch key="step3" size={32} />,
  <IconWand key="step4" size={32} />,
  <IconRocket key="step5" size={32} />,
];

const steps = [
  { titleKey: "onboarding.step1.title", descKey: "onboarding.step1.desc" },
  { titleKey: "onboarding.step2.title", descKey: "onboarding.step2.desc" },
  { titleKey: "onboarding.step3.title", descKey: "onboarding.step3.desc" },
  { titleKey: "onboarding.step4.title", descKey: "onboarding.step4.desc" },
  { titleKey: "onboarding.step5.title", descKey: "onboarding.step5.desc" },
] as const;

interface OnboardingProps {
  onDone: () => void;
  hotkey?: string;
}

export function Onboarding({ onDone, hotkey }: OnboardingProps) {
  const t = useTranslation();
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);
  const trapFocus = useFocusTrap(dialogRef);

  function handleNext() {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onDone();
    }
  }

  function handleSkip() {
    onDone();
  }

  // Auto-focus the Next button on mount and step change
  useEffect(() => {
    nextBtnRef.current?.focus();
  }, [step]);

  // Focus trap + arrow key navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onDone();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        if (step < steps.length - 1) {
          setStep(step + 1);
        } else {
          onDone();
        }
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setStep((s) => (s > 0 ? s - 1 : s));
        return;
      }
      trapFocus(e);
    },
    [onDone, step, trapFocus],
  );

  const current = steps[step];

  return (
    <div className="onboarding-overlay" onClick={handleSkip}>
      <div
        className="onboarding"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("aria.onboarding")}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="onboarding__icon">{stepIcons[step]}</div>
        <h2 className="onboarding__title">
          {t(current.titleKey, { hotkey: displayHotkey(hotkey ?? "Ctrl+Backquote") })}
        </h2>
        <p className="onboarding__desc">{t(current.descKey)}</p>
        <div className="onboarding__dots" aria-hidden="true">
          {stepIcons.map((_, i) => (
            <span
              key={i}
              className={`onboarding__dot${i === step ? " onboarding__dot--active" : ""}`}
            />
          ))}
        </div>
        <div className="onboarding__actions">
          <button className="onboarding__skip" onClick={handleSkip}>
            {t("onboarding.skip")}
          </button>
          <div className="onboarding__nav">
            <button className="onboarding__next" ref={nextBtnRef} onClick={handleNext}>
              {step < steps.length - 1 ? t("onboarding.next") : t("onboarding.getStarted")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
