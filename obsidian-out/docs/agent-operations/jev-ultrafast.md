# Jev Ultrafast Browser Agent

> **Rule Reference:** See root [`format.md`](../../format.md) for the mandatory browsing agent specification.

All browsing and web agent tasks in this repository must use **Jev Ultrafast** running on `http://127.0.0.1:8766`.

## Key Integration Points
- **Repo**: [browser-use/jev-ultrafast](https://github.com/browser-use/jev-ultrafast)
- **Local Inspector / API**: `http://127.0.0.1:8766`
- **Port config**: `TYPESAFE_DEMO_PORT=8766`
- **Protocol**: Single CDP session via Browser Harness, indexed action space `[1]..[N]`, TypeSafe operation/target heads, decoupled small LLM text helper.
