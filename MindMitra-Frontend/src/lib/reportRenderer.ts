import reportTemplates from '../i18n/reportTemplates.json';

type ReportData = {
  opening_id: string;
  trend_id: string;
  strength_id: string;
  weakness_id: string;
  suggestion_id: string;
  slots: Record<string, string>;
};

export const reportRenderer = {
  /**
   * Parse the structured AI output and inject slots into the localized templates.
   */
  renderReport(reportData: ReportData, languageCode: string = 'en'): string {
    const templates = (reportTemplates as Record<string, any>)[languageCode];
    if (!templates) {
      console.warn(`Language ${languageCode} not found in reportTemplates.`);
      return '';
    }

    const sections = [
      reportData.opening_id,
      reportData.trend_id,
      reportData.strength_id,
      reportData.weakness_id,
      reportData.suggestion_id
    ];

    const paragraphParts = sections.map(templateId => {
      let text: any = templates[templateId];
      if (!text) return '';

      // Inject slots (e.g. {name}, {domain})
      Object.entries(reportData.slots).forEach(([key, value]) => {
        const regex = new RegExp(`{${key}}`, 'g');
        text = text.replace(regex, value);
      });

      return text;
    }).filter((text: any) => text !== '');

    // Combine sentences into a smooth paragraph
    return paragraphParts.join(' ');
  }
};
