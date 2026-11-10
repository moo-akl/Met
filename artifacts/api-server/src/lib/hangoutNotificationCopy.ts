import {
  SUPPORTED_LOCALE_CODES,
  type SupportedLocaleCode,
} from "./supportedLocales";

type NotificationCopy = { title: string; body: string };
type HangoutLocaleCopy = {
  ratingPrompt: NotificationCopy;
  joinRequest: NotificationCopy & { anonymousRequester: string };
  accepted: NotificationCopy;
  declined: NotificationCopy;
  updated: NotificationCopy;
  cancelled: NotificationCopy;
};

const HANGOUT_NOTIFICATION_COPY: Record<SupportedLocaleCode, HangoutLocaleCopy> = {
  en: {
    ratingPrompt: {
      title: "How was the Hangout?",
      body: "Your Hangout has ended. Rate the host in Met.",
    },
    joinRequest: {
      title: "New hangout join request",
      body: "{{requesterName}} asked to join your plan. Open Met to review.",
      anonymousRequester: "Someone",
    },
    accepted: {
      title: "Your hangout request was accepted",
      body: "You can now join the plan chat. Tap to open it.",
    },
    declined: {
      title: "Your hangout request was declined",
      body: "Open Met to explore other hangouts.",
    },
    updated: {
      title: "Hangout plan updated",
      body: "A hangout you joined has changed. Open Met for details.",
    },
    cancelled: {
      title: "Hangout plan cancelled",
      body: "A hangout you joined was cancelled. Open Met to see your plans.",
    },
  },
  es: {
    ratingPrompt: {
      title: "¿Qué tal estuvo la quedada?",
      body: "La quedada ha terminado. Valora al anfitrión en Met.",
    },
    joinRequest: {
      title: "Nueva solicitud para unirse a la quedada",
      body: "{{requesterName}} pidió unirse a tu plan. Abre Met para revisarla.",
      anonymousRequester: "Alguien",
    },
    accepted: {
      title: "Se aceptó tu solicitud para unirte a la quedada",
      body: "Ya puedes unirte al chat del plan. Toca para abrirlo.",
    },
    declined: {
      title: "Se rechazó tu solicitud para unirte a la quedada",
      body: "Abre Met para descubrir otras quedadas.",
    },
    updated: {
      title: "Plan de quedada actualizado",
      body: "Ha cambiado una quedada a la que te uniste. Abre Met para ver los detalles.",
    },
    cancelled: {
      title: "Plan de quedada cancelado",
      body: "Se canceló una quedada a la que te uniste. Abre Met para ver tus planes.",
    },
  },
  ar: {
    ratingPrompt: {
      title: "كيف كان اللقاء؟",
      body: "انتهى اللقاء. قيّم المضيف في Met.",
    },
    joinRequest: {
      title: "طلب جديد للانضمام إلى اللقاء",
      body: "{{requesterName}} طلب الانضمام إلى خطتك. افتح Met لمراجعة الطلب.",
      anonymousRequester: "شخص ما",
    },
    accepted: {
      title: "تم قبول طلبك للانضمام إلى اللقاء",
      body: "يمكنك الآن الانضمام إلى دردشة الخطة. اضغط لفتحها.",
    },
    declined: {
      title: "تم رفض طلبك للانضمام إلى اللقاء",
      body: "افتح Met لاستكشاف لقاءات أخرى.",
    },
    updated: {
      title: "تم تحديث خطة اللقاء",
      body: "طرأ تغيير على لقاء انضممت إليه. افتح Met لمعرفة التفاصيل.",
    },
    cancelled: {
      title: "تم إلغاء خطة اللقاء",
      body: "تم إلغاء لقاء انضممت إليه. افتح Met للاطلاع على خططك.",
    },
  },
  zh: {
    ratingPrompt: {
      title: "聚会体验怎么样？",
      body: "聚会已结束。请在 Met 为主办人评分。",
    },
    joinRequest: {
      title: "有人申请加入聚会",
      body: "{{requesterName}}申请加入你的计划。打开 Met 查看并处理。",
      anonymousRequester: "有人",
    },
    accepted: {
      title: "你的聚会申请已获通过",
      body: "你现在可以加入计划聊天。点击打开。",
    },
    declined: {
      title: "你的聚会申请未获通过",
      body: "打开 Met，看看其他聚会。",
    },
    updated: {
      title: "聚会计划已更新",
      body: "你参加的聚会有了变动。打开 Met 查看详情。",
    },
    cancelled: {
      title: "聚会计划已取消",
      body: "你参加的聚会已取消。打开 Met 查看你的计划。",
    },
  },
  ru: {
    ratingPrompt: {
      title: "Как прошла встреча?",
      body: "Встреча завершилась. Оцените организатора в Met.",
    },
    joinRequest: {
      title: "Новая заявка на участие во встрече",
      body: "{{requesterName}} хочет присоединиться к вашему плану. Откройте Met, чтобы рассмотреть заявку.",
      anonymousRequester: "Кто-то",
    },
    accepted: {
      title: "Ваша заявка на встречу одобрена",
      body: "Теперь вы можете присоединиться к чату плана. Нажмите, чтобы открыть.",
    },
    declined: {
      title: "Ваша заявка на встречу отклонена",
      body: "Откройте Met, чтобы найти другие встречи.",
    },
    updated: {
      title: "План встречи обновлён",
      body: "Встреча, к которой вы присоединились, изменилась. Подробности — в Met.",
    },
    cancelled: {
      title: "План встречи отменён",
      body: "Встреча, к которой вы присоединились, отменена. Откройте Met, чтобы посмотреть планы.",
    },
  },
  fr: {
    ratingPrompt: {
      title: "Comment s'est passée la rencontre ?",
      body: "La rencontre est terminée. Évaluez l'hôte dans Met.",
    },
    joinRequest: {
      title: "Nouvelle demande pour rejoindre une rencontre",
      body: "{{requesterName}} a demandé à rejoindre votre plan. Ouvrez Met pour examiner la demande.",
      anonymousRequester: "Quelqu'un",
    },
    accepted: {
      title: "Votre demande pour la rencontre a été acceptée",
      body: "Vous pouvez maintenant rejoindre la discussion du plan. Touchez pour l'ouvrir.",
    },
    declined: {
      title: "Votre demande pour la rencontre a été refusée",
      body: "Ouvrez Met pour découvrir d'autres rencontres.",
    },
    updated: {
      title: "Plan de rencontre mis à jour",
      body: "Une rencontre à laquelle vous participez a changé. Ouvrez Met pour en savoir plus.",
    },
    cancelled: {
      title: "Plan de rencontre annulé",
      body: "Une rencontre à laquelle vous participez a été annulée. Ouvrez Met pour voir vos plans.",
    },
  },
  vi: {
    ratingPrompt: {
      title: "Buổi gặp diễn ra thế nào?",
      body: "Buổi gặp đã kết thúc. Hãy đánh giá người tổ chức trên Met.",
    },
    joinRequest: {
      title: "Có yêu cầu tham gia buổi gặp mới",
      body: "{{requesterName}} muốn tham gia kế hoạch của bạn. Mở Met để xem yêu cầu.",
      anonymousRequester: "Ai đó",
    },
    accepted: {
      title: "Yêu cầu tham gia buổi gặp đã được chấp nhận",
      body: "Bạn có thể tham gia trò chuyện về kế hoạch. Nhấn để mở.",
    },
    declined: {
      title: "Yêu cầu tham gia buổi gặp đã bị từ chối",
      body: "Mở Met để khám phá những buổi gặp khác.",
    },
    updated: {
      title: "Kế hoạch buổi gặp đã được cập nhật",
      body: "Buổi gặp bạn tham gia đã có thay đổi. Mở Met để xem chi tiết.",
    },
    cancelled: {
      title: "Kế hoạch buổi gặp đã bị hủy",
      body: "Buổi gặp bạn tham gia đã bị hủy. Mở Met để xem các kế hoạch của bạn.",
    },
  },
  pt: {
    ratingPrompt: {
      title: "Como foi o encontro?",
      body: "O encontro terminou. Avalie o anfitrião no Met.",
    },
    joinRequest: {
      title: "Novo pedido para participar do encontro",
      body: "{{requesterName}} pediu para participar do seu plano. Abra o Met para analisar.",
      anonymousRequester: "Alguém",
    },
    accepted: {
      title: "Seu pedido para participar do encontro foi aceito",
      body: "Agora você pode entrar no chat do plano. Toque para abrir.",
    },
    declined: {
      title: "Seu pedido para participar do encontro foi recusado",
      body: "Abra o Met para explorar outros encontros.",
    },
    updated: {
      title: "Plano do encontro atualizado",
      body: "Um encontro do qual você participa mudou. Abra o Met para ver os detalhes.",
    },
    cancelled: {
      title: "Plano do encontro cancelado",
      body: "Um encontro do qual você participa foi cancelado. Abra o Met para ver seus planos.",
    },
  },
  nl: {
    ratingPrompt: {
      title: "Hoe was de bijeenkomst?",
      body: "De bijeenkomst is afgelopen. Beoordeel de host in Met.",
    },
    joinRequest: {
      title: "Nieuw verzoek om aan de bijeenkomst mee te doen",
      body: "{{requesterName}} wil aan je plan meedoen. Open Met om het verzoek te bekijken.",
      anonymousRequester: "Iemand",
    },
    accepted: {
      title: "Je verzoek voor de bijeenkomst is geaccepteerd",
      body: "Je kunt nu deelnemen aan de planchat. Tik om deze te openen.",
    },
    declined: {
      title: "Je verzoek voor de bijeenkomst is afgewezen",
      body: "Open Met om andere bijeenkomsten te bekijken.",
    },
    updated: {
      title: "Het plan voor de bijeenkomst is bijgewerkt",
      body: "Een bijeenkomst waaraan je meedoet is gewijzigd. Open Met voor meer informatie.",
    },
    cancelled: {
      title: "Het plan voor de bijeenkomst is geannuleerd",
      body: "Een bijeenkomst waaraan je meedoet is geannuleerd. Open Met om je plannen te bekijken.",
    },
  },
};

export type HangoutNotificationType =
  | "hangout_host_rating_prompt"
  | "hangout_join_request"
  | "hangout_join_decision"
  | "hangout_updated"
  | "hangout_cancelled";

/**
 * Resolve the recipient's preferred language, accepting regional tags and
 * falling back to English when the profile has no supported locale.
 */
export function getHangoutNotificationCopy(
  locale: string | null | undefined,
  type: HangoutNotificationType,
  options: {
    requestStatus?: "accepted" | "declined";
    requesterName?: string;
  } = {},
): NotificationCopy {
  const baseLocale = locale?.trim().toLowerCase().split(/[-_]/, 1)[0];
  const supportedLocale = SUPPORTED_LOCALE_CODES.find(
    (code) => code === baseLocale,
  );
  const copy = HANGOUT_NOTIFICATION_COPY[supportedLocale ?? "en"];

  switch (type) {
    case "hangout_host_rating_prompt":
      return copy.ratingPrompt;
    case "hangout_join_request":
      return {
        title: copy.joinRequest.title,
        body: copy.joinRequest.body.replace(
          "{{requesterName}}",
          () =>
            options.requesterName?.trim() ||
            copy.joinRequest.anonymousRequester,
        ),
      };
    case "hangout_join_decision":
      return options.requestStatus === "accepted"
        ? copy.accepted
        : copy.declined;
    case "hangout_updated":
      return copy.updated;
    case "hangout_cancelled":
      return copy.cancelled;
  }
}
