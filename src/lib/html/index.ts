import A from './A.svelte'
import Area from './Area.svelte'
import Article from './Article.svelte'
import Aside from './Aside.svelte'
import Base from './Base.svelte'
import Blockquote from './Blockquote.svelte'
import Br from './Br.svelte'
import Button from './Button.svelte'
import Code from './Code.svelte'
import Col from './Col.svelte'
import Dd from './Dd.svelte'
import Div from './Div.svelte'
import Dl from './Dl.svelte'
import Dt from './Dt.svelte'
import Embed from './Embed.svelte'
import Fieldset from './Fieldset.svelte'
import Figcaption from './Figcaption.svelte'
import Figure from './Figure.svelte'
import Footer from './Footer.svelte'
import Form from './Form.svelte'
import H1 from './H1.svelte'
import H2 from './H2.svelte'
import H3 from './H3.svelte'
import H4 from './H4.svelte'
import H5 from './H5.svelte'
import H6 from './H6.svelte'
import Header from './Header.svelte'
import Hr from './Hr.svelte'
import I from './I.svelte'
import Img from './Img.svelte'
import Input from './Input.svelte'
import Label from './Label.svelte'
import Legend from './Legend.svelte'
import Li from './Li.svelte'
import Main from './Main.svelte'
import Nav from './Nav.svelte'
import Ol from './Ol.svelte'
import Option from './Option.svelte'
import P from './P.svelte'
import Param from './Param.svelte'
import Pre from './Pre.svelte'
import Section from './Section.svelte'
import Select from './Select.svelte'
import Source from './Source.svelte'
import Span from './Span.svelte'
import Table from './Table.svelte'
import Tbody from './Tbody.svelte'
import Td from './Td.svelte'
import Textarea from './Textarea.svelte'
import Tfoot from './Tfoot.svelte'
import Th from './Th.svelte'
import Thead from './Thead.svelte'
import Tr from './Tr.svelte'
import Track from './Track.svelte'
import Ul from './Ul.svelte'
import Wbr from './Wbr.svelte'

export {
    A,
    Area,
    Article,
    Aside,
    Base,
    Blockquote,
    Br,
    Button,
    Code,
    Col,
    Dd,
    Div,
    Dl,
    Dt,
    Embed,
    Fieldset,
    Figcaption,
    Figure,
    Footer,
    Form,
    H1,
    H2,
    H3,
    H4,
    H5,
    H6,
    Header,
    Hr,
    I,
    Img,
    Input,
    Label,
    Legend,
    Li,
    Main,
    Nav,
    Ol,
    Option,
    P,
    Param,
    Pre,
    Section,
    Select,
    Source,
    Span,
    Table,
    Tbody,
    Td,
    Textarea,
    Tfoot,
    Th,
    Thead,
    Tr,
    Track,
    Ul,
    Wbr
}

export type MotionComponents = {
    /**
     * A motion-enhanced a element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.a
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.a>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    a: typeof A

    /**
     * A motion-enhanced article element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.article
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.article>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    article: typeof Article

    /**
     * A motion-enhanced aside element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.aside
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.aside>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    aside: typeof Aside

    /**
     * A motion-enhanced blockquote element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.blockquote
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.blockquote>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    blockquote: typeof Blockquote

    /**
     * A motion-enhanced button element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.button
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.button>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    button: typeof Button

    /**
     * A motion-enhanced code element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.code
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.code>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    code: typeof Code

    /**
     * A motion-enhanced dd element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.dd
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.dd>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    dd: typeof Dd

    /**
     * A motion-enhanced div element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.div
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.div>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    div: typeof Div

    /**
     * A motion-enhanced dl element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.dl
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.dl>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    dl: typeof Dl

    /**
     * A motion-enhanced dt element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.dt
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.dt>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    dt: typeof Dt

    /**
     * A motion-enhanced fieldset element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.fieldset
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.fieldset>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    fieldset: typeof Fieldset

    /**
     * A motion-enhanced figcaption element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.figcaption
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.figcaption>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    figcaption: typeof Figcaption

    /**
     * A motion-enhanced figure element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.figure
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.figure>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    figure: typeof Figure

    /**
     * A motion-enhanced footer element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.footer
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.footer>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    footer: typeof Footer

    /**
     * A motion-enhanced form element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.form
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.form>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    form: typeof Form

    /**
     * A motion-enhanced h1 element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.h1
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.h1>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    h1: typeof H1

    /**
     * A motion-enhanced h2 element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.h2
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.h2>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    h2: typeof H2

    /**
     * A motion-enhanced h3 element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.h3
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.h3>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    h3: typeof H3

    /**
     * A motion-enhanced h4 element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.h4
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.h4>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    h4: typeof H4

    /**
     * A motion-enhanced h5 element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.h5
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.h5>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    h5: typeof H5

    /**
     * A motion-enhanced h6 element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.h6
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.h6>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    h6: typeof H6

    /**
     * A motion-enhanced header element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.header
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.header>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    header: typeof Header

    /**
     * A motion-enhanced i element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.i
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    i: typeof I

    /**
     * A motion-enhanced label element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.label
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.label>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    label: typeof Label

    /**
     * A motion-enhanced legend element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.legend
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.legend>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    legend: typeof Legend

    /**
     * A motion-enhanced li element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.li
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.li>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    li: typeof Li

    /**
     * A motion-enhanced main element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.main
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.main>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    main: typeof Main

    /**
     * A motion-enhanced nav element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.nav
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.nav>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    nav: typeof Nav

    /**
     * A motion-enhanced ol element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.ol
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.ol>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    ol: typeof Ol

    /**
     * A motion-enhanced option element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.option
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.option>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    option: typeof Option

    /**
     * A motion-enhanced p element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.p
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.p>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    p: typeof P

    /**
     * A motion-enhanced pre element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.pre
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.pre>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    pre: typeof Pre

    /**
     * A motion-enhanced section element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.section
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.section>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    section: typeof Section

    /**
     * A motion-enhanced select element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.select
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.select>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    select: typeof Select

    /**
     * A motion-enhanced span element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.span
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.span>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    span: typeof Span

    /**
     * A motion-enhanced table element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.table
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.table>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    table: typeof Table

    /**
     * A motion-enhanced tbody element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.tbody
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.tbody>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    tbody: typeof Tbody

    /**
     * A motion-enhanced td element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.td
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.td>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    td: typeof Td

    /**
     * A motion-enhanced textarea element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.textarea
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.textarea>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    textarea: typeof Textarea

    /**
     * A motion-enhanced tfoot element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.tfoot
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.tfoot>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    tfoot: typeof Tfoot

    /**
     * A motion-enhanced th element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.th
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.th>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    th: typeof Th

    /**
     * A motion-enhanced thead element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.thead
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.thead>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    thead: typeof Thead

    /**
     * A motion-enhanced tr element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.tr
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.tr>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    tr: typeof Tr

    /**
     * A motion-enhanced ul element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.ul
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * >
     *   Content
     * </motion.ul>
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    ul: typeof Ul

    /**
     * A motion-enhanced area element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.area
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    area: typeof Area

    /**
     * A motion-enhanced base element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.base
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    base: typeof Base

    /**
     * A motion-enhanced br element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.br
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    br: typeof Br

    /**
     * A motion-enhanced col element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.col
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    col: typeof Col

    /**
     * A motion-enhanced embed element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.embed
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    embed: typeof Embed

    /**
     * A motion-enhanced hr element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.hr
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    hr: typeof Hr

    /**
     * A motion-enhanced img element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.img
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    img: typeof Img

    /**
     * A motion-enhanced input element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.input
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    input: typeof Input

    /**
     * A motion-enhanced param element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.param
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    param: typeof Param

    /**
     * A motion-enhanced source element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.source
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    source: typeof Source

    /**
     * A motion-enhanced track element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.track
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    track: typeof Track

    /**
     * A motion-enhanced wbr element with animation capabilities.
     *
     * [Motion Documentation](https://motion.dev/docs/react-motion-component)
     *
     * Currently supported features:
     * * `initial`
     * * `animate`
     * * `transition`
     * * `whileTap`
     *
     * ```svelte
     * <motion.wbr
     *   initial={{ opacity: 0, scale: 0.8 }}
     *   animate={{ opacity: 1, scale: 1 }}
     *   transition={{ duration: 0.3 }}
     * />
     * ```
     *
     * Note: Some motion features are still under development.
     * Check documentation for latest updates.
     */
    wbr: typeof Wbr
}
