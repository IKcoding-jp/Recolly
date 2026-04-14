import { Link } from 'react-router-dom'
import { HERO_CARD_SAMPLES, type HeroCardMediaType } from '../data/heroSamples'
import styles from './HeroSection.module.css'

const MEDIA_COLOR_VAR: Record<HeroCardMediaType, string> = {
  anime: 'var(--color-anime)',
  movie: 'var(--color-movie)',
  drama: 'var(--color-drama)',
  book: 'var(--color-book)',
  manga: 'var(--color-manga)',
  game: 'var(--color-game)',
}

const CARD_POSITION_CLASSES = [styles.card1, styles.card2, styles.card3] as const

/**
 * ランディングページのヒーロー。
 * 左側に主訴求と CTA、右側に浮遊する作品カード 3 枚を配置する。
 */
export function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className={styles.grid}>
        <div>
          <div className={`${styles.eyebrow} reveal`}>
            ジャンルをまたぐ、あなたの記録のための場所
          </div>
          <h1 className={`${styles.title} reveal`}>
            観たもの、読んだもの、
            <br />
            プレイしたもの。
            <br />
            全部ひとつの棚に。
          </h1>
          <p className={`${styles.subtitle} reveal`}>
            アニメ、映画、ドラマ、本、漫画、ゲーム。ジャンルをまたいで作品を記録・振り返りできるアプリです。
          </p>
          <div className={`${styles.ctaRow} reveal`}>
            <Link className={styles.btnPrimary} to="/signup">
              無料で始める
            </Link>
            <span className={styles.note}>永久無料・カード不要</span>
          </div>
        </div>

        <div className={`${styles.deck} reveal`} aria-hidden="true">
          {HERO_CARD_SAMPLES.map((sample, i) => (
            <div key={sample.title} className={`${styles.card} ${CARD_POSITION_CLASSES[i]}`}>
              <div className={styles.cardMeta}>
                <span className={styles.cardMediaLabel}>
                  <span
                    className={styles.cardGenreDot}
                    style={{ background: MEDIA_COLOR_VAR[sample.mediaType] }}
                  />
                  {sample.mediaLabel}
                </span>
                <span>{sample.serial}</span>
              </div>
              <h4 className={styles.cardTitle}>{sample.title}</h4>
              <div className={styles.cardBar}>
                <span
                  className={styles.cardBarFill}
                  style={{ width: `${sample.progressPercent}%` }}
                />
              </div>
              <div className={styles.cardRating}>
                {sample.rating.toFixed(1)}
                <span className={styles.cardRatingMax}> / 10</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${styles.genres} reveal`} aria-hidden="true">
        <span className={`${styles.genreItem} ${styles.genreAnime}`}>アニメ</span>
        <span className={`${styles.genreItem} ${styles.genreMovie}`}>映画</span>
        <span className={`${styles.genreItem} ${styles.genreDrama}`}>ドラマ</span>
        <span className={`${styles.genreItem} ${styles.genreBook}`}>本</span>
        <span className={`${styles.genreItem} ${styles.genreManga}`}>漫画</span>
        <span className={`${styles.genreItem} ${styles.genreGame}`}>ゲーム</span>
      </div>
    </section>
  )
}
