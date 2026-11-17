/** 測試用最小合法行程。每次呼叫回傳新物件。 */
export const validDoc = () => ({
  schemaVersion: "1.0",
  trip: {
    id: "test-trip",
    title: "測試旅程",
    startDate: "2027-09-15",
    endDate: "2027-09-17",
    timezone: "America/Vancouver",
    currency: "CAD",
    locale: "zh-TW",
    transportMode: "drive",
    constraints: { maxDailyDriveMinutes: 240, minAfternoonFreeMinutes: 60, minimumTwoNightBases: 1 },
  },
  travelers: [],
  days: [
    {
      id: "day-01",
      date: "2027-09-15",
      title: "第一天",
      baseCity: "Banff",
      driveMinutes: 110,
      items: [
        { id: "a", type: "activity", startTime: "10:00", endTime: "11:00", title: "景點",
          place: { name: "Lake Louise", latitude: 51.4254, longitude: -116.1773 } },
        { id: "b", type: "free-time", startTime: "14:00", endTime: "15:30", title: "留白" },
      ],
    },
    { id: "day-02", date: "2027-09-16", title: "第二天", baseCity: "Banff", driveMinutes: 0, items: [] },
  ],
  checklists: [{ id: "packing", title: "行李", scope: "trip", items: [{ id: "passport", label: "護照", required: true }] }],
  sources: [],
});
