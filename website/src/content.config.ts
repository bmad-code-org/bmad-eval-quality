import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { z } from 'zod';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: (context) =>
      z.preprocess((data: any) => {
        if (data && typeof data === 'object' && !data.title) {
          return {
            title: 'AD-31 Coverage Predicates',
            description: 'AD-31 coverage predicate table',
            ...data,
          };
        }
        return data;
      }, docsSchema()(context)),
  }),
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
