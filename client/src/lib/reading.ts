const RESUME_KEY = 'myblog.reading-resume';

export type ReadingResume = {
  articleId: number;
  title: string;
  /** 0–1 之间的阅读进度 */
  progress: number;
  updatedAt: number;
};

/**
 * 「继续阅读」把进度存在浏览器本地：不需要登录，也不需要后端表。
 * 代价是换设备或清缓存就丢——第一版接受这个代价。
 */
export function saveResume(resume: ReadingResume): void {
  try {
    window.localStorage.setItem(RESUME_KEY, JSON.stringify(resume));
  } catch {
    // 存不进去就算了，不能因为记进度失败打断阅读
  }
}

export function getResume(): ReadingResume | null {
  try {
    const raw = window.localStorage.getItem(RESUME_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const candidate = parsed as Partial<ReadingResume>;
    if (
      typeof candidate.articleId !== 'number' ||
      typeof candidate.title !== 'string' ||
      typeof candidate.progress !== 'number'
    ) {
      return null;
    }

    return {
      articleId: candidate.articleId,
      title: candidate.title,
      progress: Math.min(1, Math.max(0, candidate.progress)),
      updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearResume(): void {
  try {
    window.localStorage.removeItem(RESUME_KEY);
  } catch {
    // 忽略
  }
}
