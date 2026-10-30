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
  // `anim` picks an interactive animation (mtp | memory | driving | compression | optimization),
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
  people: [
    { name: "조영은 (Youngeun Cho)", role: "Principal Investigator", group: "Faculty", image: "", link: "", email: "" },

    { name: "라이언", role: "Ph.D. Student", group: "Ph.D. Students", image: "", link: "" }, // 실제 한국 이름

    { name: "양승언", role: "M.S. Student", group: "M.S. Students", image: "", link: "" },
    { name: "오상영", role: "M.S. Student", group: "M.S. Students", image: "", link: "" },

    { name: "손혜성", role: "", group: "Undergraduate Researchers", image: "", link: "" },
    { name: "윤호영 (Hoyoung Yoon)", role: "", group: "Undergraduate Researchers", image: "", link: "" },
    { name: "남궁길", role: "", group: "Undergraduate Researchers", image: "", link: "" },
    { name: "김윤호", role: "", group: "Undergraduate Researchers", image: "", link: "" },
  ],

  // { year, title, authors, venue, links: { pdf, code, project } }
  publications: [],
};
