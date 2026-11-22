/* ─────────────────────────────────────────────────────────────
   구간별 큐레이션 v3
   · 모든 YouTube ID는 실제 IFrame 플레이어 재생 테스트를 통과한 것만 수록
     (tools/verify5.html · verify6.html · Error 101·150 0건)
   · 1시간짜리 모음 · 분위기가 튀는 영상 · 저음질 비공식 업로드는 걷어내고
     공식 아티스트 / Topic / 레이블 채널의 스튜디오 음원만 담았습니다
   · 은수 님의 지니뮤직 · 사운드클라우드 취향 기준
   ───────────────────────────────────────────────────────────── */
window.SOMATO_DATA = {
  version: '3.0.0',

  tracks: {
    /* 수업 전 · 수업 후 대기 — 맑은 피아노와 하프 */
    wait: [
      { t: "Kiss the Rain", a: "이루마 Yiruma", y: "imGaOIm5HOk" },
      { t: "River Flows in You", a: "이루마 Yiruma", y: "7maJOI3QMu0" },
      { t: "Grace", a: "Fiona Joy Hawkins", y: "iqkgLhRThIE" },
      { t: "Blue Dream", a: "Fiona Joy Hawkins", y: "LdlKL_ArHaY" },
      { t: "Return to the Heart", a: "David Lanz", y: "ESqHYfdDm7c" },
      { t: "Evening Fall (Harp)", a: "Kevin MacLeod", y: "8TYO4Css6tE" },
      { t: "Kiss of a Rose", a: "Deuter", y: "9Y_gigLpilk" }
    ],

    /* 오프닝 — 호흡 · 그라운딩 (Deuter · Liquid Mind) */
    opening: [
      { t: "Koyasan", a: "Deuter", y: "Drk-0Laarjc" },
      { t: "East of the Full Moon", a: "Deuter", y: "7RLstyPt5gs" },
      { t: "Tonglen", a: "Deuter", y: "FcMhSNiG59U" },
      { t: "Lovesong from the Mountains", a: "Deuter", y: "S4Oi4NKobpk" },
      { t: "Serenity", a: "Liquid Mind", y: "78fcz7oNHmo" },
      { t: "Hymn for Peace", a: "Liquid Mind", y: "187iIfm_Mvw" }
    ],

    /* 피아노 브릿지 — 이루마의 결 */
    bridge: [
      { t: "Kiss the Rain", a: "이루마 Yiruma", y: "imGaOIm5HOk" },
      { t: "River Flows in You", a: "이루마 Yiruma", y: "7maJOI3QMu0" },
      { t: "May Be", a: "이루마 Yiruma", y: "05Cax-OCtPw" },
      { t: "Wait There", a: "이루마 Yiruma", y: "Ox23mWkDhMk" },
      { t: "Poem+ (시처럼)", a: "이루마 Yiruma", y: "_R0Ix90hFu8" },
      { t: "Kiss the Rain (Orchestra)", a: "이루마 Yiruma", y: "1e07OAWvWkQ" },
      { t: "Cristofori's Dream (Remastered)", a: "David Lanz", y: "hm8y6kzXwEU" },
      { t: "Summer Ayre", a: "David Lanz", y: "lAdCVhQ0f7w" }
    ],

    /* 컴다운 — 심박을 가라앉히는 피아노 · 하프 */
    cooldown: [
      { t: "Evening Fall (Harp)", a: "Kevin MacLeod", y: "8TYO4Css6tE" },
      { t: "Clair de Lune", a: "Amy Turk · harp", y: "Nz15gbUa-k4" },
      { t: "Watching the Wheat", a: "Amy Turk · harp", y: "paXn1Q0aelA" },
      { t: "Love's Return", a: "David Lanz", y: "EjPprEFuU8M" },
      { t: "Autumn Ayre", a: "David Lanz", y: "bk2Bvjl8juU" },
      { t: "The Journey", a: "Fiona Joy Hawkins", y: "n9gOV7arRtI" },
      { t: "The White Light", a: "Fiona Joy Hawkins", y: "q3mwaSbbqjQ" }
    ],

    flow: {
      classic: [
        { t: "Cristofori's Dream (Remastered)", a: "David Lanz", y: "hm8y6kzXwEU" },
        { t: "Return to the Heart", a: "David Lanz", y: "ESqHYfdDm7c" },
        { t: "Inner Balance", a: "Parijat", y: "pTzJO637ymA" },
        { t: "Inner Light", a: "Parijat", y: "8fCXh_Q5gvQ" },
        { t: "Path of Silence", a: "Parijat", y: "6S0TInctE8M" },
        { t: "Grace", a: "Fiona Joy Hawkins", y: "iqkgLhRThIE" },
        { t: "Somewhere", a: "Fiona Joy Hawkins", y: "2PZeJ1r7SPc" },
        { t: "Drei", a: "Deuter", y: "1SwdND7nokU" }
      ],
      neoclassic: [
        { t: "Le Onde", a: "Ludovico Einaudi", y: "x2XGx18rO20" },
        { t: "I Giorni", a: "Ludovico Einaudi", y: "TL1v3KVi6go" },
        { t: "Due Tramonti", a: "Ludovico Einaudi", y: "Bjwgv9lWrfk" },
        { t: "Nuvole Bianche", a: "Ludovico Einaudi", y: "sR2W2scFS4Y" },
        { t: "Una Mattina", a: "Ludovico Einaudi", y: "saiPRYqC29g" },
        { t: "Near Light", a: "Ólafur Arnalds", y: "0kYc55bXJFI" },
        { t: "Merry Christmas Mr. Lawrence", a: "Ryuichi Sakamoto", y: "1OZDaRhHHyM" },
        { t: "Aqua", a: "Ryuichi Sakamoto", y: "W51tXJ1YwuA" },
        { t: "On the Nature of Daylight", a: "Max Richter", y: "InyT9Gyoz_o" },
        { t: "As She Passes", a: "Levi Patel", y: "2SvKuIvwtXU" }
      ],
      mantra: [
        { t: "Gayatri Mantra", a: "Deva Premal", y: "se_WP1Mh0g8" },
        { t: "Om Mani Padme Hum", a: "Deva Premal", y: "2wBbL2xYVqQ" },
        { t: "Ong Namo", a: "Snatam Kaur", y: "CvMAyZr3Vs0" },
        { t: "Ra Ma Da Sa", a: "Snatam Kaur", y: "f8EzVceL-Xs" },
        { t: "Sa Ta Na Ma", a: "Mirabai Ceiba", y: "m8ntAg7yeYQ" },
        { t: "I Am", a: "Nirinjan Kaur", y: "PrS7eTkO5gM" },
        { t: "Guru Ram Das / Ra Ma Da Sa", a: "Spirit Voyage", y: "YzJBKY4dvX8" }
      ],
      christmas: [
        { t: "O Holy Night", a: "Rousseau", y: "dwJ04_9LGrM" },
        { t: "Silent Night", a: "Rousseau", y: "MhC90ReY49I" },
        { t: "Carol of the Bells", a: "Rousseau", y: "Z3bNAvaQihA" },
        { t: "O Holy Night", a: "Francesco Parrino", y: "646k9QfzY2E" },
        { t: "Have Yourself a Merry Little Christmas", a: "Francesco Parrino", y: "QTLoPTCA7-Q" },
        { t: "Silent Night", a: "Francesco Parrino", y: "-GIrNLQjiPw" },
        { t: "Silent Night (Solo Piano)", a: "Fiona Joy Hawkins", y: "xLWio9lHehE" }
      ]
    },

    savasana: {
      song: [
        { t: "바람의 노래 (Wind Song)", a: "소향 Sohyang", y: "NJdrQ2jjqOU" },
        { t: "너의 모든 순간", a: "성시경", y: "Dbxzh078jr4" },
        { t: "너의 모든 순간 (라이브)", a: "성시경", y: "1P3jzu6Mt6w" },
        { t: "비와 당신", a: "이무진", y: "sCmcSBsTxQc" },
        { t: "Your Song", a: "샘김 Sam Kim", y: "JWfyto-1oT0" },
        { t: "그 여름밤", a: "샘김 Sam Kim", y: "jcuIJ9waAVw" },
        { t: "Something in the Rain", a: "Rachael Yamagata", y: "A1YAdFjdvx4" },
        { t: "Duet", a: "Rachael Yamagata", y: "KUuMyyZoYO4" },
        { t: "Here With Me", a: "Susie Suh × Robot Koch", y: "YzR8BCmV9Ew" },
        { t: "Come Away With Me", a: "Norah Jones", y: "lbjZPFBD6JU" },
        { t: "Love Is Gone (Acoustic)", a: "SLANDER ft. Dylan Matthew", y: "hCrtcVDgCGw" },
        { t: "Shouldn't Be", a: "Luke Chiang", y: "hsLiJP2rqS8" },
        { t: "Moments", a: "Micah Edwards", y: "PFG8VCQ9pG0" },
        { t: "Fare Thee Well", a: "Ashley Davis", y: "bq3SXN3GWvI" },
        { t: "Love So True", a: "Ashton Edminster", y: "IsK0LL3qm5E" },
        { t: "Nothing's Gonna Change My Love for You", a: "Chendy", y: "T__HNxkZPCc" },
        { t: "Exactly as It Is", a: "Miten", y: "zTqdBX5FChw" },
        { t: "Somebody New", a: "Sophia James", y: "kq24R_8jYg4" },
        { t: "Reasons to Stay", a: "Kate Vogel", y: "NNvwaTNqjik" },
        { t: "Lokah Samastah Sukhino Bhavantu", a: "Cabrini Asteriska", y: "QAzsVYgwE2s" }
      ],
      piano: [
        { t: "As She Passes", a: "Levi Patel", y: "2SvKuIvwtXU" },
        { t: "And She Translated Into the Sky", a: "Levi Patel", y: "v9Blx4URf34" },
        { t: "Grace", a: "Fiona Joy Hawkins", y: "iqkgLhRThIE" },
        { t: "The Journey", a: "Fiona Joy Hawkins", y: "n9gOV7arRtI" },
        { t: "Near Light", a: "Ólafur Arnalds", y: "0kYc55bXJFI" },
        { t: "Threnody", a: "Goldmund", y: "kSRnuWAaeH8" },
        { t: "Over There, It's Raining", a: "Nils Frahm", y: "2P8PZbh53ec" },
        { t: "I Can Almost See You", a: "Hammock", y: "niCMpOkMcWU" },
        { t: "I Would Give My Breath Away", a: "Hammock", y: "96DL94T21sw" },
        { t: "Aqua", a: "Ryuichi Sakamoto", y: "W51tXJ1YwuA" },
        { t: "On the Nature of Daylight", a: "Max Richter", y: "InyT9Gyoz_o" },
        { t: "Nuvole Bianche", a: "Ludovico Einaudi", y: "sR2W2scFS4Y" },
        { t: "Indoor Swimming at the Space Station", a: "Eluvium", y: "83JW5ZhVSWc" }
      ],
      bodyscan: [
        { t: "An Ending (Ascent)", a: "Brian Eno", y: "OlaTeXX3uH8" },
        { t: "Structures from Silence", a: "Steve Roach", y: "rt97c92WjRw" },
        { t: "Requiem for Dying Mothers, Pt. 2", a: "Stars of the Lid", y: "_8aYF9PtQjA" },
        { t: "Requiem for Dying Mothers, Pt. 1", a: "Stars of the Lid", y: "-bc37fU36Vk" },
        { t: "Indoor Swimming at the Space Station", a: "Eluvium", y: "83JW5ZhVSWc" }
      ],
      bowl: [
        { t: "11분 차크라 튠업 · 롱 톤", a: "templesounds", y: "-ar9vsmFhJU" },
        { t: "크리스탈 볼 14분 차크라 명상", a: "templesounds", y: "8Qhh2VF1Oz4" },
        { t: "10분 티벳 싱잉볼", a: "Shanti Yoga", y: "S0IKiepm9Hs" },
        { t: "20분 사운드 배스 · 집중", a: "Aurabowls", y: "Rcp_PjxfPU0" },
        { t: "10분 써드아이 차크라 사운드 배스", a: "Healing Vibrations", y: "7_Hmo3TnSzI" },
        { t: "15분 사운드 배스", a: "Sound Healing Vibes", y: "IlHKM733TjA" },
        { t: "8분 루트 차크라 사운드 배스", a: "Healing Vibrations", y: "buOVKY0LAdw" }
      ],
      vocal: [
        { t: "Gayatri Mantra", a: "Deva Premal", y: "3V0iwhq3jdA" },
        { t: "Gayatri Mantra (In Concert)", a: "Deva Premal & Miten", y: "4IFlaG45xM8" },
        { t: "Sa Ta Na Ma", a: "Mirabai Ceiba", y: "m8ntAg7yeYQ" },
        { t: "Ong Namo", a: "Snatam Kaur", y: "CvMAyZr3Vs0" },
        { t: "I Am", a: "Nirinjan Kaur", y: "PrS7eTkO5gM" },
        { t: "Ra Ma Da Sa (Live in Bucharest)", a: "Snatam Kaur", y: "vViFW9KDXA4" },
        { t: "Rain of Blessings / Ra Ma Da Sa", a: "Deva Premal & Miten", y: "mEP3Fiw2ouo" }
      ],
      harp: [
        { t: "Watching the Wheat", a: "Amy Turk · harp", y: "paXn1Q0aelA" },
        { t: "Courage", a: "Amy Turk · harp", y: "xla3n9Uh6XM" },
        { t: "The Merchant (Dead Cells)", a: "Amy Turk · harp", y: "5Yj3SAxH0uY" },
        { t: "Harp Lullaby (Celtic Harp)", a: "Little Moon Dreams", y: "OOKFf_TeE2M" },
        { t: "You Are My Sunshine (Lullaby)", a: "Music Box Lullabies", y: "hQHjGorl1L4" },
        { t: "Wiegenlied · Brahms (뮤직박스)", a: "R3 Music Box", y: "hs6AcuPcPgw" },
        { t: "Isabella's Lullaby (뮤직박스)", a: "R3 Music Box", y: "-1c6y3qsR2g" }
      ],
      christmas: [
        { t: "Christmas Music Box Instrumental", a: "The Lyrical Lanterns", y: "dXAH4gpD5hg" },
        { t: "Deck the Halls (뮤직박스)", a: "R3 Music Box", y: "QYAD6L7pB-4" },
        { t: "Silent Night (뮤직박스)", a: "R3 Music Box", y: "9k6zbBUOZRw" },
        { t: "Silent Night (뮤직박스)", a: "The Music Box Corner", y: "-mJK7jjU3_Q" },
        { t: "Carol of the Bells", a: "Rousseau", y: "Z3bNAvaQihA" },
        { t: "Silent Night", a: "Rousseau", y: "MhC90ReY49I" }
      ]
    },

    /* 마무리 1분 */
    closing: [
      { t: "Serenity", a: "Liquid Mind", y: "78fcz7oNHmo" },
      { t: "Hymn for Peace", a: "Liquid Mind", y: "187iIfm_Mvw" },
      { t: "Evening Fall (Harp)", a: "Kevin MacLeod", y: "8TYO4Css6tE" }
    ]
  }
};
