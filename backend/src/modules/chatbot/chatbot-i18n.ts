/**
 * Chatbot Multilingual — canonical message catalog.
 *
 * Source plan: §5.5 (Natural-language-first automation) + §5.20
 * (16-locale coverage).
 *
 * Solid:
 *   • SRP — only the chat message catalog. Each entry is a stable
 *     message id (kebab-case) + per-locale string.
 *   • DRY — one entry per message; no copy-pasted strings in chat /
 *     agent code. Callers render via `t(chat, locale, 'message.id')`.
 *   • OCP — adding a locale = new entry per message. Adding a
 *     message = new row in CHAT_MESSAGES + translations.
 *   • No external i18n library — Phase 6 ships the catalog as plain
 *     data. A future phase may swap in ICU MessageFormat without
 *     changing callers.
 */

/**
 * LocaleId — imported from the OOB locale registry so this file is
 * the single consumer-side layer.
 */
import { LocaleId } from '../localization/locale.registry';

export type ChatMessageId =
  | 'intent.understood'
  | 'intent.clarification_needed'
  | 'tool.invoked'
  | 'tool.awaiting_approval'
  | 'approval.granted'
  | 'approval.rejected'
  | 'error.permission_denied'
  | 'error.not_found'
  | 'error.internal'
  | 'session.expired'
  | 'twin.wizard_started'
  | 'twin.wizard_step_completed'
  | 'twin.deployed'
  | 'twin.archived'
  | 'agent.execution_started'
  | 'agent.execution_succeeded'
  | 'agent.execution_failed';

interface ChatMessage {
  id: ChatMessageId;
  // Default English copy is the source of truth.
  defaultText: string;
  // Per-locale translations.
  translations: Partial<Record<LocaleId, string>>;
}

export const CHAT_MESSAGES: ReadonlyArray<ChatMessage> = [
  {
    id: 'intent.understood',
    defaultText: 'Got it. Working on "{intent}" now.',
    translations: {
      'fr-FR': 'Compris. Je travaille sur "{intent}" maintenant.',
      'de-DE': 'Verstanden. Ich arbeite jetzt an "{intent}".',
      'es-ES': 'Entendido. Trabajando en "{intent}" ahora.',
      'pt-BR': 'Entendi. Trabalhando em "{intent}" agora.',
      'it-IT': 'Capito. Sto lavorando su "{intent}" adesso.',
      'ja-JP': '了解しました。「{intent}」を実行中です。',
      'zh-CN': '明白了。正在处理 "{intent}"。',
      'ko-KR': '알겠습니다. "{intent}" 작업을 시작합니다.',
      'ar-SA': 'فهمت. أعمل على "{intent}" الآن.',
      'he-IL': 'הבנתי. עובד על "{intent}" כעת.',
      'pl-PL': 'Rozumiem. Pracuję nad "{intent}".',
      'ru-RU': 'Понял. Работаю над "{intent}".',
      'tr-TR': 'Anladım. "{intent}" üzerinde çalışıyorum.',
      'nl-NL': 'Begrepen. Ik werk nu aan "{intent}".',
      'en-GB': 'Got it. Working on "{intent}" now.',
    },
  },
  {
    id: 'intent.clarification_needed',
    defaultText: 'Could you clarify what you mean? I parsed "{input}" but could not match a known intent.',
    translations: {
      'fr-FR': 'Pourriez-vous clarifier votre demande ? J\'ai analysé "{input}" mais aucun intent connu ne correspond.',
      'de-DE': 'Könnten Sie das bitte präzisieren? Ich habe "{input}" analysiert, aber kein bekannter Intent passt.',
      'es-ES': '¿Podría aclarar lo que quiere decir? He analizado "{input}" pero no coincide con ningún intent conocido.',
      'ja-JP': '「{input}」を解析しましたが、既知の intent に一致しませんでした。詳しく教えていただけますか？',
      'zh-CN': '请澄清一下您的意思？我已解析 "{input}"，但未匹配到已知 intent。',
      'ar-SA': 'هل يمكنك التوضيح؟ قمت بتحليل "{input}" لكنه لا يطابق intent معروف.',
      'he-IL': 'אפשר להבהיר? ניתחתי את "{input}" אך לא זיהיתי intent מוכר.',
    },
  },
  {
    id: 'tool.invoked',
    defaultText: 'Invoking {tool}…',
    translations: {
      'fr-FR': 'Appel de {tool}…',
      'de-DE': 'Rufe {tool} auf…',
      'es-ES': 'Invocando {tool}…',
      'ja-JP': '{tool} を呼び出し中…',
      'zh-CN': '正在调用 {tool}…',
      'ar-SA': 'استدعاء {tool}…',
      'he-IL': 'מפעיל {tool}…',
    },
  },
  {
    id: 'tool.awaiting_approval',
    defaultText: 'Action "{tool}" requires approval before I can run it.',
    translations: {
      'fr-FR': 'L\'action "{tool}" nécessite une approbation.',
      'de-DE': 'Aktion "{tool}" benötigt Freigabe.',
      'es-ES': 'La acción "{tool}" requiere aprobación.',
      'ja-JP': 'アクション "{tool}" は承認が必要です。',
      'zh-CN': '操作 "{tool}" 需要批准。',
      'ar-SA': 'الإجراء "{tool}" يتطلب موافقة.',
      'he-IL': 'הפעולה "{tool}" דורשת אישור.',
    },
  },
  {
    id: 'approval.granted',
    defaultText: 'Approval recorded — proceeding.',
    translations: {
      'fr-FR': 'Approbation enregistrée — j\'avance.',
      'de-DE': 'Freigabe erteilt — ich fahre fort.',
      'es-ES': 'Aprobación registrada — procediendo.',
      'ja-JP': '承認を記録しました — 続行します。',
      'zh-CN': '已记录批准 — 继续执行。',
    },
  },
  {
    id: 'approval.rejected',
    defaultText: 'Approval rejected — I will not perform the action.',
    translations: {
      'fr-FR': 'Approbation refusée — je n\'effectuerai pas l\'action.',
      'de-DE': 'Freigabe abgelehnt — ich führe die Aktion nicht aus.',
      'es-ES': 'Aprobación rechazada — no realizaré la acción.',
      'ja-JP': '承認が拒否されました — アクションを実行しません。',
      'zh-CN': '已拒绝批准 — 我不会执行该操作。',
    },
  },
  {
    id: 'error.permission_denied',
    defaultText: 'Permission denied.',
    translations: {
      'fr-FR': 'Autorisation refusée.',
      'de-DE': 'Berechtigung verweigert.',
      'es-ES': 'Permiso denegado.',
      'ja-JP': '権限がありません。',
      'zh-CN': '权限被拒绝。',
      'ar-SA': 'تم رفض الإذن.',
      'he-IL': 'ההרשאה נדחתה.',
    },
  },
  {
    id: 'error.not_found',
    defaultText: 'Resource not found.',
    translations: {
      'fr-FR': 'Ressource introuvable.',
      'de-DE': 'Ressource nicht gefunden.',
      'es-ES': 'Recurso no encontrado.',
      'ja-JP': 'リソースが見つかりません。',
      'zh-CN': '资源未找到。',
    },
  },
  {
    id: 'error.internal',
    defaultText: 'Something went wrong on our side. Please retry.',
    translations: {
      'fr-FR': 'Une erreur est survenue de notre côté. Veuillez réessayer.',
      'de-DE': 'Auf unserer Seite ist ein Fehler aufgetreten. Bitte erneut versuchen.',
      'es-ES': 'Algo salió mal por nuestra parte. Inténtelo de nuevo.',
      'ja-JP': 'サーバ側でエラーが発生しました。再試行してください。',
      'zh-CN': '服务端出现错误，请重试。',
    },
  },
  {
    id: 'session.expired',
    defaultText: 'Your session has expired. Please sign in again.',
    translations: {
      'fr-FR': 'Votre session a expiré. Veuillez vous reconnecter.',
      'de-DE': 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.',
      'es-ES': 'Su sesión ha expirado. Inicie sesión de nuevo.',
      'ja-JP': 'セッションの有効期限が切れました。再度サインインしてください。',
      'zh-CN': '会话已过期，请重新登录。',
    },
  },
  {
    id: 'twin.wizard_started',
    defaultText: 'Twin wizard started — describe your goal.',
    translations: {
      'fr-FR': 'Assistant Twin démarré — décrivez votre objectif.',
      'de-DE': 'Twin-Assistent gestartet — beschreiben Sie Ihr Ziel.',
      'es-ES': 'Asistente Twin iniciado — describa su objetivo.',
      'ja-JP': 'Twin ウィザードを開始 — 目標を記述してください。',
      'zh-CN': 'Twin 向导已启动 — 请描述您的目标。',
    },
  },
  {
    id: 'twin.wizard_step_completed',
    defaultText: 'Step {step} of 4 complete.',
    translations: {
      'fr-FR': 'Étape {step} sur 4 terminée.',
      'de-DE': 'Schritt {step} von 4 abgeschlossen.',
      'es-ES': 'Paso {step} de 4 completado.',
      'ja-JP': 'ステップ {step} / 4 が完了しました。',
      'zh-CN': '步骤 {step} / 4 已完成。',
    },
  },
  {
    id: 'twin.deployed',
    defaultText: 'Twin deployed. It will only act on resources you can access.',
    translations: {
      'fr-FR': 'Twin déployé. Il agira uniquement sur les ressources auxquelles vous avez accès.',
      'de-DE': 'Twin bereitgestellt. Es wirkt nur auf Ressourcen, auf die Sie Zugriff haben.',
      'es-ES': 'Twin desplegado. Solo actuará sobre los recursos a los que usted tiene acceso.',
      'ja-JP': 'Twin をデプロイしました。アクセス権のあるリソースのみに作用します。',
      'zh-CN': 'Twin 已部署。仅对您有权访问的资源执行操作。',
    },
  },
  {
    id: 'twin.archived',
    defaultText: 'Twin archived.',
    translations: {
      'fr-FR': 'Twin archivé.',
      'de-DE': 'Twin archiviert.',
      'es-ES': 'Twin archivado.',
      'ja-JP': 'Twin をアーカイブしました。',
      'zh-CN': 'Twin 已归档。',
    },
  },
  {
    id: 'agent.execution_started',
    defaultText: 'Running {agent}…',
    translations: {
      'fr-FR': 'Exécution de {agent}…',
      'de-DE': 'Führe {agent} aus…',
      'es-ES': 'Ejecutando {agent}…',
      'ja-JP': '{agent} を実行中…',
      'zh-CN': '正在运行 {agent}…',
    },
  },
  {
    id: 'agent.execution_succeeded',
    defaultText: 'Done in {durationMs}ms.',
    translations: {
      'fr-FR': 'Terminé en {durationMs}ms.',
      'de-DE': 'Fertig in {durationMs}ms.',
      'es-ES': 'Hecho en {durationMs}ms.',
      'ja-JP': '{durationMs}ms で完了。',
      'zh-CN': '已完成，耗时 {durationMs}ms。',
    },
  },
  {
    id: 'agent.execution_failed',
    defaultText: 'Failed: {reason}',
    translations: {
      'fr-FR': 'Échec : {reason}',
      'de-DE': 'Fehlgeschlagen: {reason}',
      'es-ES': 'Falló: {reason}',
      'ja-JP': '失敗: {reason}',
      'zh-CN': '失败：{reason}',
    },
  },
];

/**
 * Translate a chat message id. Falls back to English (defaultText) when
 * the locale is missing a translation. Substitutes `{var}` placeholders.
 */
export function translate(args: {
  id: ChatMessageId;
  locale: LocaleId;
  vars?: Record<string, string | number>;
}): string {
  const msg = CHAT_MESSAGES.find((m) => m.id === args.id);
  if (!msg) return `[missing-message:${args.id}]`;
  const template = msg.translations[args.locale] ?? msg.defaultText;
  if (!args.vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    args.vars && args.vars[k] !== undefined ? String(args.vars[k]) : `{${k}}`,
  );
}

/**
 * Lookup a message without rendering placeholders. Returns null if the
 * id is unknown.
 */
export function getMessage(id: ChatMessageId): ChatMessage | null {
  return CHAT_MESSAGES.find((m) => m.id === id) ?? null;
}

/**
 * Build a per-locale stats summary. Useful for dashboards that need to
 * show "X% of messages are translated to {locale}".
 */
export function translationCoverage(locale: LocaleId): {
  total: number;
  translated: number;
  coverage: number;
} {
  const total = CHAT_MESSAGES.length;
  const translated = CHAT_MESSAGES.filter(
    (m) => m.translations[locale] !== undefined,
  ).length;
  return {
    total,
    translated,
    coverage: total === 0 ? 1 : translated / total,
  };
}
