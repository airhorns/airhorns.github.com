import type { ComponentType } from "react";

export interface PostMeta {
  title: string;
  date: string;
  description: string;
  slug: string;
}

export interface Post {
  meta: PostMeta;
  Component: ComponentType;
}

const modules = import.meta.glob<{
  frontmatter: PostMeta;
  default: ComponentType;
}>("@/content/posts/*.mdx", { eager: true });

export function getAllPosts(): Post[] {
  return Object.values(modules)
    .map((mod) => ({
      meta: mod.frontmatter,
      Component: mod.default,
    }))
    .sort((a, b) => (a.meta.date > b.meta.date ? -1 : 1));
}

export function getPostBySlug(slug: string): Post | undefined {
  return getAllPosts().find((p) => p.meta.slug === slug);
}
