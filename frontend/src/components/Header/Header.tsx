import styles from './Header.module.css';

interface HeaderProps {
  totalCount: number;
  children?: React.ReactNode;
}

export function Header({ totalCount, children }: HeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        🎬 Diafilm Katalógus
        <span className={styles.count}>({totalCount} diafilm)</span>
      </h1>
      {children}
    </header>
  );
}