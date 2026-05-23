<script>
    import skills from '@content/skills.json';
</script>

<div class="skills-subsection">
    <ul>
        {#each skills as skill}
            <li>{skill}</li>
        {/each}
    </ul>
</div>

<style>
    ul {
        text-align: center;
        color: var(--paragraph-colour);
        font-size: 20px;
        list-style: none;
        -webkit-column-count: 4;
        -moz-column-count: 4;
        column-count: 4;
    }

    @media only screen and (max-width: 1270px) {
        ul {
        -webkit-column-count: 3;
        -moz-column-count: 3;
        column-count: 3;
        }
    }

    @media only screen and (max-width: 1100px) {
        ul {
        font-size: 18px;
        -webkit-column-count: 2;
        -moz-column-count: 2;
        column-count: 2;
        }
    }

    @media only screen and (max-width: 860px) {
        ul {
        -webkit-column-count: 4;
        -moz-column-count: 4;
        column-count: 4;
        }
    }

    @media only screen and (max-width: 600px) {
        ul {
        font-size: 18px;
        -webkit-column-count: 3;
        -moz-column-count: 3;
        column-count: 3;
        }
    }

    @media only screen and (max-width: 470px) {
        ul {
        text-align: center;
        font-size: 18px;
        -webkit-column-count: 2;
        -moz-column-count: 2;
        column-count: 2;
        margin-left: -2em;
        }

        ul li::before {
        display: none;
    }
    }
</style>