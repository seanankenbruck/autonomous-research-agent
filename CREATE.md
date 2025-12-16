autonomous-research-agent/
├── CREATE.md
├── README.md
├── docker-compose.yml
├── Makefile
├── .env.example
├── .gitignore
│
├── src/
│   ├── agent/
│   │   ├── core.ts              # Main agent loop
│   │   ├── reasoning.ts         # Reasoning engine
│   │   ├── reflection.ts        # Reflection system
│   │   └── types.ts             # Core types
│   │
│   ├── memory/
│   │   ├── memory-system.ts     # Main memory manager
│   │   ├── episodic.ts          # Episodic memory
│   │   ├── semantic.ts          # Semantic memory
│   │   ├── procedural.ts        # Procedural memory
│   │   └── stores/
│   │       ├── vector-store.ts  # Chroma client
│   │       ├── document-store.ts # SQLite client
│   │       └── graph-store.ts   # (Optional future)
│   │
│   ├── tools/
│   │   ├── search.ts            # Web search
│   │   ├── fetch.ts             # Content fetching
│   │   ├── analyze.ts           # Content analysis
│   │   └── synthesize.ts        # Information synthesis
│   │
│   ├── llm/
│   │   └── client.ts            # Anthropic client wrapper
│   │
│   └── utils/
│       ├── logger.ts
│       └── config.ts
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── scripts/
│   ├── init-db.ts               # Database initialization
│   └── seed-data.ts             # Optional test data
│
├── storage/                     # Local data (gitignored)
│   ├── chroma/
│   ├── sqlite/
│   └── logs/
│
└── docs/
    ├── architecture.md
    ├── memory-system.md
    └── examples.md