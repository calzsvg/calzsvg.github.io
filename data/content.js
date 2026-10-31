// AISL site content. Edit this file to update the site — no build step needed.
// Images: put files in /images and set `image: "images/xxx.jpg"`. Leave empty for a placeholder.

window.AISL = {
  lab: {
    short: "AISL",
    name: "AISL",
    fullName: "AI Systems Lab (AISL)",
    university: "Hanyang University",
    intro:
      "We at the AI Systems Lab (AISL) build AI that is fast, efficient, and reliable in the real world. " +
      "Our research spans efficient inference with multi-token prediction, memory and GPU optimization, " +
      "model compression, and model optimization, with applications to autonomous driving.",
    join:
      "If you are interested in research opportunities at AISL (graduate students, undergraduate interns), " +
      "please contact Prof. Youngeun Cho by email.",
    groupPhoto: "",
    email: "choye@hanyang.ac.kr",
    address: "",
  },

  news: [
    { date: "2026-10", text: "AISL website launched." },
  ],

  // Projects shown on Home (featured: true) and on the Research page.
  // `anim` picks an interactive animation (mtp | llm | memory | gpu | realtime | driving | drone | physical | compression | edge | optimization),
  // shown when `image` is empty.
  research: [
    {
      title: "Multi-Token Prediction (MTP)",
      anim: "mtp",
      featured: true,
      image: "",
      summary:
        "We study multi-token prediction for large language models, where a model predicts several future tokens at once. " +
        "MTP improves training signal and enables faster decoding, reducing inference latency without sacrificing quality.",
      link: "",
    },
    {
      title: "LLM Acceleration",
      anim: "llm",
      featured: false,
      image: "",
      summary:
        "We accelerate large language model inference through efficient attention, KV-cache management, " +
        "and decoding strategies, cutting latency and cost for serving LLMs at scale.",
      link: "",
    },
    {
      title: "Memory & GPU Optimization",
      anim: "memory",
      featured: true,
      image: "",
      summary:
        "We develop systems techniques that make training and inference of large models fit and run efficiently on GPUs — " +
        "reducing memory footprint, improving kernel efficiency, and maximizing hardware utilization.",
      link: "",
    },
    {
      title: "GPU Architecture",
      anim: "gpu",
      featured: false,
      image: "",
      summary:
        "We study how AI workloads map onto GPU architectures — streaming multiprocessors, memory hierarchy, " +
        "and scheduling — to design faster kernels and inform future accelerator designs.",
      link: "",
    },
    {
      title: "Real-Time Systems",
      anim: "realtime",
      featured: false,
      image: "",
      summary:
        "We build real-time systems that run AI workloads with predictable latency, " +
        "scheduling tasks across CPUs and GPUs so that safety-critical deadlines are always met.",
      link: "",
    },
    {
      title: "Autonomous Driving",
      anim: "driving",
      featured: true,
      image: "",
      summary:
        "We build perception and decision-making models for autonomous vehicles that run in real time " +
        "on resource-constrained onboard hardware.",
      link: "",
    },
    {
      title: "Drones",
      anim: "drone",
      featured: true,
      image: "",
      summary:
        "We develop on-board AI for drones (UAVs) and coordinated UAV swarms — real-time perception, navigation, and control " +
        "that run within the tight compute, memory, and power budgets of small aerial platforms.",
      link: "",
    },
    {
      title: "Physical AI",
      anim: "physical",
      featured: false,
      image: "",
      summary:
        "We develop AI that perceives and acts in the physical world, such as robots that plan, reach, and manipulate objects " +
        "in real time with on-board compute.",
      link: "",
    },
    {
      title: "Model Compression",
      anim: "compression",
      featured: false,
      image: "",
      summary:
        "We make deep learning models lightweight through quantization, pruning, and knowledge distillation, " +
        "so they can be deployed on edge and embedded devices.",
      link: "",
    },
    {
      title: "Edge Device Computing",
      anim: "edge",
      featured: false,
      image: "",
      summary:
        "We run AI directly on edge devices instead of the cloud, partitioning and offloading computation " +
        "to cut latency, bandwidth, and energy while keeping data on the device.",
      link: "",
    },
    {
      title: "Model Optimization & Performance Improvement",
      anim: "optimization",
      featured: false,
      image: "",
      summary:
        "We improve the accuracy, speed, and efficiency of AI models through better architectures, training methods, " +
        "and inference-time optimization.",
      link: "",
    },
  ],

  // group: "Faculty" | "Ph.D. Students" | "M.S. Students" | "Undergraduate Researchers" | "Alumni"
  // Sections appear in the order their first member is listed here.
  // name: Korean name (or English if none), nameEn: English name, github: GitHub username.
  // interests: use research titles exactly as written above.
  people: [
    { name: "조영은", nameEn: "Youngeun Cho", role: "Principal Investigator", group: "Faculty", image: "", link: "", email: "" },

    { name: "라이언", nameEn: "Ieon Na", role: "Ph.D. Student", group: "Ph.D. Students", image: "",
      email: "112fkdldjs@naver.com", github: "Nyan-SouthKorea", interests: ["Physical AI"] },

    { name: "양승언", nameEn: "Seungun Yang", role: "M.S. Student", group: "M.S. Students", image: "",
      email: "seungun0915@hanyang.ac.kr", github: "Fusili23", interests: ["GPU Architecture", "Real-Time Systems"] },
    { name: "오상영", nameEn: "Sangyoung Oh", role: "M.S. Student", group: "M.S. Students", image: "",
      email: "helloosy@hanyang.ac.kr", github: "hello-osy", interests: ["Drones", "LLM Acceleration", "Real-Time Systems", "Memory & GPU Optimization"] },
    { name: "Shend Sanaja", role: "M.Eng. Student", group: "M.S. Students", image: "",
      email: "shs8733@hanyang.ac.kr", github: "ShendiS", interests: ["Drones", "Real-Time Systems", "Edge Device Computing"] },

    { name: "손혜성", nameEn: "Hyesung Son", role: "", group: "Undergraduate Researchers", image: "",
      email: "wlq8112@hanyang.ac.kr", github: "s0nh", interests: ["Multi-Token Prediction (MTP)", "Real-Time Systems"] },
    { name: "윤호영", nameEn: "Hoyoung Yoon", role: "", group: "Undergraduate Researchers", image: "",
      email: "hoyoung1208@hanyang.ac.kr", github: "calzsvg", interests: ["Multi-Token Prediction (MTP)", "Autonomous Driving"] },
    { name: "남궁길", nameEn: "Gil Namgung", role: "", group: "Undergraduate Researchers", image: "",
      email: "gill1026@hanyang.ac.kr", github: "gill1026", interests: ["Autonomous Driving"] },
    { name: "김윤호", nameEn: "Yunho Kim", role: "", group: "Undergraduate Researchers", image: "",
      email: "wew303000@hanyang.ac.kr", github: "goldpiggg", interests: ["GPU Architecture", "Real-Time Systems"] },
    { name: "김서경", nameEn: "SeoKyoung Kim", role: "", group: "Undergraduate Researchers", image: "",
      email: "sk0829@hanyang.ac.kr", github: "tjrud", interests: ["Drones", "LLM Acceleration", "Real-Time Systems"] },
  ],

  // { year, title, authors, venue, links: { pdf, code, project } }
  publications: [],
};
