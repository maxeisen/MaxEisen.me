<script>
    import { getContext } from 'svelte';
    import ExperienceModal from './ExperienceModal.svelte';

    const { open } = getContext('simple-modal');

    const modal1 = () => {
        open(ExperienceModal, {
            
        });
    };
</script>

<html lang="en">
    <h1 class="section-title" id="projects">Projects</h1>
    <div class="projects-subsection">
    
    </div>
</html>