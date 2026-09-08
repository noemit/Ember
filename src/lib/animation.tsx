import * as React from 'react';
import { AnimatePresence, motion, type Transition, type Variants } from 'motion/react';
import { cn } from '@/lib/utils';

export const springTransition: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.8,
};

export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 6, scale: 0.98 },
};

export const slideInRightVariants: Variants = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 12 },
};

export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

type FadeInProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function FadeIn({ children, className, delay = 0 }: FadeInProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={fadeInVariants}
      transition={{ duration: 0.16, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type SlideUpProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

export function SlideUp({ children, className, delay = 0 }: SlideUpProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={slideUpVariants}
      transition={{ ...springTransition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type AnimatedListProps = {
  children: React.ReactNode;
  className?: string;
  mode?: 'popLayout' | 'sync' | 'wait';
};

export function AnimatedList({ children, className, mode = 'popLayout' }: AnimatedListProps) {
  return (
    <motion.div layout className={className}>
      <AnimatePresence initial={false} mode={mode}>
        {children}
      </AnimatePresence>
    </motion.div>
  );
}

type AnimatedListItemProps = {
  children: React.ReactNode;
  className?: string;
};

export function AnimatedListItem({ children, className }: AnimatedListItemProps) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
      transition={springTransition}
      className={cn('group', className)}
    >
      {children}
    </motion.div>
  );
}

type StaggerContainerProps = {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
};

export function StaggerContainer({ children, className, staggerDelay = 0.04 }: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={slideUpVariants} transition={springTransition} className={className}>
      {children}
    </motion.div>
  );
}
