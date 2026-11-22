/* ─────────────────────────────────────────────────────────────
   구간별 큐레이션
   · 모든 YouTube ID는 IFrame 플레이어 실제 재생 테스트를 통과한 것만 수록
     (tools/verify.html · tools/verify2.html / Error 101·150 없음)
   · 은수 님의 사운드클라우드 · 지니뮤직 취향(만트라·스파·뉴에이지·네오클래식) 기준
   ───────────────────────────────────────────────────────────── */
window.SOMATO_DATA = {
  version: '1.0.0',

  tracks: {
    /* 수업 전 · 수업 후 대기 */
    wait: [
      { t: 'Drei', a: 'Deuter', y: '1SwdND7nokU' },
      { t: 'Serenity', a: 'Liquid Mind', y: '78fcz7oNHmo' },
      { t: 'Relaxing Music N°056', a: 'relaxdaily', y: 'x8noBB1NIys' },
      { t: 'Deep Relaxation', a: 'Kevin MacLeod', y: 'fgauFOtjRTE' },
      { t: 'Weightless', a: 'Marconi Union', y: 'UfcAVejslrU' }
    ],

    /* 오프닝 — 호흡 · 그라운딩 */
    opening: [
      { t: 'Koyasan · Reiki Sound Healing', a: 'Deuter', y: '2YeofmJvCcg' },
      { t: 'Relaxing Music for Meditation', a: 'Deuter', y: 'BXbsO8exZns' },
      { t: "Shambhala's Secret Sound", a: 'Shambhala Spa', y: '_qunQ72RwgI' },
      { t: 'Ethereal Meditative Ambient', a: 'Shambhala', y: 'hu2BaymI6nA' },
      { t: 'Zen Garden · Spa Healing', a: 'Sound Healing Center', y: 'Pe7_APPZgoE' },
      { t: 'Reiki Music · Energy Healing', a: 'Music for Body and Spirit', y: 'mUp9Wbw5aQ4' },
      { t: 'Sound Bath', a: 'Aurabowls', y: 'kp7mvD1y-WE' },
      { t: 'Drei', a: 'Deuter', y: '1SwdND7nokU' }
    ],

    /* 피아노 브릿지 — 이루마의 결 */
    bridge: [
      { t: 'Kiss the Rain', a: '이루마 Yiruma', y: 'imGaOIm5HOk' },
      { t: 'Kiss the Rain (5분 연주)', a: '이루마 Yiruma', y: 'I0et_hDtfxY' },
      { t: 'River Flows in You', a: '이루마 Yiruma', y: '7maJOI3QMu0' },
      { t: 'River Flows in You', a: '이루마 Yiruma', y: 'fiBvOKmuWKg' },
      { t: 'River Flows in You', a: 'Rousseau', y: 'NPBCbTZWnq0' },
      { t: '형을 위한 노래 (piano for brother)', a: '이정혁 Lee Jeonghyeok', y: 'qO_BGk0aEx0' },
      { t: 'Piano for Brother', a: 'Riyandi Kusuma', y: 'cmjr_LzdcBg' },
      { t: 'Relaxing Piano N°045', a: 'relaxdaily', y: 'aOHHkbLm4rQ' }
    ],

    /* 메인 플로우 — 테마별 프리셋 */
    flow: {
      classic: [
        { t: "Cristofori's Dream", a: 'David Lanz', y: '9wxrB41PMhw' },
        { t: "Cristofori's Dream (Remastered)", a: 'David Lanz', y: 'hm8y6kzXwEU' },
        { t: 'Inner Balance', a: 'Parijat', y: 'pTzJO637ymA' },
        { t: 'Path of Silence', a: 'Parijat', y: '6S0TInctE8M' },
        { t: 'Return to Yourself', a: 'Parijat', y: 'ViInXVSHi7w' },
        { t: 'Reiki Healing Waves', a: 'Parijat', y: '6gysVE_vCcU' },
        { t: 'Grace', a: 'Fiona Joy Hawkins', y: 'iqkgLhRThIE' },
        { t: 'All Is Not Lost', a: 'Lisa Swerdlow', y: '7R3H1fT1BHQ' },
        { t: 'Drei', a: 'Deuter', y: '1SwdND7nokU' },
        { t: 'Serenity', a: 'Liquid Mind', y: '78fcz7oNHmo' }
      ],
      neoclassic: [
        { t: 'Nuvole Bianche', a: 'Ludovico Einaudi', y: 'sR2W2scFS4Y' },
        { t: 'Nuvole Bianche (Live)', a: 'Ludovico Einaudi', y: 'VUCI-1vIbUo' },
        { t: 'Una Mattina', a: 'Ludovico Einaudi', y: '-8X_aMT5z0A' },
        { t: 'Amazing Space', a: 'Kristin Hoffmann', y: 'AQS8bh7Q7TI' },
        { t: 'Something in the Rain', a: 'Rachael Yamagata', y: 'A1YAdFjdvx4' },
        { t: 'I Will Rise', a: 'Lucinda Drayton', y: 'o0LHz8j9o3Y' },
        { t: 'Wild Mountainside', a: 'Ashley Davis', y: 'J2-QVo4YWdU' },
        { t: 'Relaxing Music N°056', a: 'relaxdaily', y: 'x8noBB1NIys' },
        { t: 'Meditation Impromptu 01', a: 'Kevin MacLeod', y: 'emqdD0D4RyE' }
      ],
      mantra: [
        { t: "Ishq' Allah", a: 'Deva Premal & Miten', y: 'gpSyVUh6chw' },
        { t: 'I Am', a: 'Nirinjan Kaur', y: 'PrS7eTkO5gM' },
        { t: 'I Am (Krishan Liquid Mix)', a: 'Nirinjan Kaur', y: 'OZbD29J7FLM' },
        { t: 'Aad Guray Nameh', a: 'Mirabai Ceiba', y: 'WsDKzulNW00' },
        { t: 'Guru Ram Das', a: 'Mirabai Ceiba', y: 'LbQ4zHxhoSI' },
        { t: 'Gobinday Mukunday', a: 'Snatam Kaur', y: '27ORb1DnSNo' },
        { t: 'Heart of the Universe', a: 'Snatam Kaur & Peter Kater', y: 'wXbax5qveo4' },
        { t: 'Just To Know You', a: 'Peter Kater & Snatam Kaur', y: 'DfiigsRfoao' },
        { t: 'Hymn to the Divine Mother', a: 'Devi Prayer', y: 'MZ0h1sb1IFI' }
      ],
      christmas: [
        { t: 'O Holy Night', a: 'Rousseau', y: 'dwJ04_9LGrM' },
        { t: 'O Holy Night (Piano Cover)', a: 'Francesco Parrino', y: '646k9QfzY2E' },
        { t: 'Silent Night', a: 'Rousseau', y: 'MhC90ReY49I' },
        { t: 'Silent Night · Christmas Instrumental', a: 'J Music & Sound', y: 'HXAZOG-ghP4' },
        { t: 'Relaxing Christmas Soft Piano', a: 'Angel Music', y: 'UJqzs7-0RXA' },
        { t: 'Instrumental Christmas Piano', a: 'Soothing Relaxation', y: 'ncjuqj0WN6s' },
        { t: 'Christmas Piano & Fireplace', a: 'Christmas Glow Ambience', y: 'iuwmrSlCvIY' },
        { t: 'Christmas Piano · Study & Sleep', a: 'Minnz Piano', y: 'lH9tnZDGr6w' }
      ]
    },

    /* 컴다운 — 심박을 가라앉히는 */
    cooldown: [
      { t: 'Relaxing Piano · Romantic', a: 'Soothing Relaxation', y: '3NycM9lYdRI' },
      { t: 'Rain and Soft Piano', a: 'Relaxing Piano', y: 'o8GrqUSdzi0' },
      { t: 'Relaxing Harp Music', a: 'Soothing Relaxation', y: 'dCvEgqePl84' },
      { t: 'Serenity (Full Album)', a: 'Liquid Mind', y: 'KYsldfmeVZ8' },
      { t: 'Harp · Stress Relief & Spa', a: 'Soothing Relaxation', y: 'p6wFbdU4Tpc' },
      { t: 'Ocean Harp Music', a: 'Sarah Bhalla', y: 'ZnuPTeyvm2c' }
    ],

    /* 사바아사나 — 추천 풀 */
    savasana: {
      bowl: [
        { t: '7 Chakra Singing Bowls (70분)', a: 'templesounds', y: 'Nb3okem4OCk' },
        { t: '7 Chakra Continuous Meditation', a: 'templesounds', y: 'iT6w3cEkpm0' },
        { t: 'Crystal Chakra Meditation', a: 'templesounds', y: 'TAESZsLJdVw' },
        { t: 'Singing Bowls Healing Sounds', a: 'The Soul Resonance', y: 'lJP687Y4Kd8' },
        { t: 'Singing Bowl SoundScape', a: 'Brett Van Donsel', y: 'JAB-zW_L080' },
        { t: 'Tibetan Singing Bowl · 10분 간격', a: 'Warriorphonic', y: 'aVrOEr5pgxw' },
        { t: '10 Minute Crystal Bowl Meditation', a: 'Jess Yoga', y: 'unCya_-8ECs' },
        { t: '부교감 신경 활성 · 사운드 배스', a: 'Aurabowls', y: '6Kj-ye-aYBA' },
        { t: 'Instant Stress Relief Sound Bath', a: 'Aurabowls', y: 'PDI3mdiQuG0' }
      ],
      vocal: [
        { t: "Ishq' Allah", a: 'Deva Premal & Miten', y: 'gpSyVUh6chw' },
        { t: 'I Am', a: 'Nirinjan Kaur', y: 'PrS7eTkO5gM' },
        { t: 'Gobinday Mukunday', a: 'Snatam Kaur', y: '27ORb1DnSNo' },
        { t: 'Aad Guray Nameh', a: 'Mirabai Ceiba', y: 'WsDKzulNW00' },
        { t: 'I Will Rise', a: 'Lucinda Drayton', y: 'o0LHz8j9o3Y' },
        { t: 'Amazing Space', a: 'Kristin Hoffmann', y: 'AQS8bh7Q7TI' },
        { t: 'Hymn to the Divine Mother', a: 'Devi Prayer', y: 'MZ0h1sb1IFI' },
        { t: 'Wild Mountainside', a: 'Ashley Davis', y: 'J2-QVo4YWdU' }
      ],
      nature: [
        { t: 'Night Time Summer Nature Sounds', a: 'Jason Stephenson', y: '7GoXVDH656g' },
        { t: 'Forest Sounds at Night', a: 'SoftWaveSound', y: '0aay6rLcEdU' },
        { t: 'Relaxing Rain Sounds', a: 'Relaxing White Noise', y: 'eTeD8DAta4c' },
        { t: 'Night Ambience · Countryside', a: 'Child of Nature', y: 'U2a-RDhoxGI' }
      ],
      harp: [
        { t: 'Relaxing Harp Music', a: 'Soothing Relaxation', y: 'dCvEgqePl84' },
        { t: "Music Box Lullabies", a: "Baby's Music Box", y: 'ZqMN0g5gi2I' },
        { t: 'Relaxing Music Box', a: 'BGM channel', y: 'mvxsLNFCVaw' },
        { t: 'Fantasy Harp Music', a: 'Soothing Relaxation', y: 'Ern8qUpJzVk' }
      ],
      christmas: [
        { t: 'Christmas Carol Music Box', a: 'Flow Music', y: 'xeOCmkrH3p8' },
        { t: 'Christmas Songs Music Box', a: 'BGM channel', y: '4PCYn8VjxwA' },
        { t: 'Christmas Music Box Instrumental', a: 'The Lyrical Lanterns', y: 'dXAH4gpD5hg' },
        { t: 'Silent Night', a: 'Rousseau', y: 'MhC90ReY49I' }
      ]
    },

    /* 마무리 1분 */
    closing: [
      { t: 'Serenity', a: 'Liquid Mind', y: '78fcz7oNHmo' },
      { t: 'Deep Relaxation', a: 'Kevin MacLeod', y: 'fgauFOtjRTE' }
    ]
  }
};
