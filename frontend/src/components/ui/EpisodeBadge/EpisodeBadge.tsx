import styles from './EpisodeBadge.module.css'

type Props = {
  episodeNumber: number | null
}

export function EpisodeBadge({ episodeNumber }: Props) {
  if (episodeNumber === null) {
    return <span className={styles.badge}>作品全体</span>
  }
  return <span className={styles.badge}>第{episodeNumber}話</span>
}
