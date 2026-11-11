<footer class="footer">
    <span>© {new Date().getFullYear()} Max Eisen</span>
    <a href="https://github.com/maxeisen/MaxEisen.me/" rel="noreferrer" target="_blank">Source on GitHub</a>
</footer>

<style>
    .footer {
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: var(--space-2);
        margin-top: var(--space-8);
        padding-top: var(--space-4);
        border-top: 1px solid var(--border);
        font-size: var(--font-xs);
        color: var(--text-3);
    }
    a { color: var(--text-2); }
    a:hover { color: var(--text-strong); }
</style>
