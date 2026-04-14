import { Footer } from '../../components/ui/Footer/Footer'
import { useScrollReveal } from './hooks/useScrollReveal'
import { LandingNav } from './sections/LandingNav'
import { HeroSection } from './sections/HeroSection'
import { ProblemSection } from './sections/ProblemSection'
import { SolutionSection } from './sections/SolutionSection'
import { HowItWorksSection } from './sections/HowItWorksSection'
import { ReflectSection } from './sections/ReflectSection'
import { CreatorNoteSection } from './sections/CreatorNoteSection'
import { PromiseSection } from './sections/PromiseSection'
import { FaqSection } from './sections/FaqSection'
import { FinalCtaSection } from './sections/FinalCtaSection'
import './landingGlobal.css'
import styles from './LandingPage.module.css'

/**
 * ランディングページ。未ログインで `/` を訪問したユーザーに表示される。
 * ログイン済みは App.tsx の RootRoute で /dashboard にリダイレクトされるため
 * このコンポーネントは描画されない。
 *
 * Spec: docs/superpowers/specs/2026-04-14-landing-page-design.md
 */
export function LandingPage() {
  useScrollReveal()

  return (
    <div className={`landing-page ${styles.root}`}>
      <LandingNav />
      <main className={styles.main}>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <HowItWorksSection />
        <ReflectSection />
        <CreatorNoteSection />
        <PromiseSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </div>
  )
}
