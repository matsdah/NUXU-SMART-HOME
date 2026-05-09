import { ref } from 'vue'

export function useEditMode() {
    const isEditMode = ref(false)

    function toggleEditMode() {
        isEditMode.value = !isEditMode.value
    }

    function enterEditMode() {
        isEditMode.value = true
    }

    function exitEditMode() {
        isEditMode.value = false
    }

    return {
        isEditMode,
        toggleEditMode,
        enterEditMode,
        exitEditMode,
    }
}