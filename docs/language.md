# Language notes

**4GL** (UI / report scripts) uses event sections with a colon:

```baan
field.tdsls401.orno:
before.input:
    | UI only
```

**3GL** (DLL, `function main`, most DAL) is procedural. DAL hooks are functions, not sections:

```baan
function extern long before.save.object()
{
    return(0)
}
```

The preprocessor (`#include`, `#ifdef`) exists only for 3GL. `bic` compiles 3GL; 4GL goes through `std_gen` first.

For the language itself see **Infor ES Programmers Guide** (Infor Customer Portal KB2924522; cited in [Infor LN documentation](https://docs.infor.com/ln/2026.x/en-us/lnesolh/lndebugworkbenchug/iam1633953930176.html)). The PDF itself is not public — search that KB on the Customer Portal or open it from LN Studio help.
