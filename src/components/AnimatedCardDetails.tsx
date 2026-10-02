import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

interface AnimatedCardDetailsProps {
  children: ReactNode;
  open: boolean;
}

const expansionEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

export function AnimatedCardDetails({ children, open }: AnimatedCardDetailsProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          initial={prefersReducedMotion ? false : { height: 0, opacity: 0, y: -6 }}
          animate={{ height: 'auto', opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0, y: -4 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.32, ease: expansionEase }}
          className="w-full min-w-0 max-w-full overflow-hidden"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
